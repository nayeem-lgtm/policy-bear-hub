import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  ScreenShareOff,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  recordJoin,
  recordLeave,
  updateMeeting,
  type MeetingRecord,
} from "@/lib/meetings";
import { cn } from "@/lib/utils";

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

interface PeerView {
  id: string;
  name: string;
  initials: string;
  stream: MediaStream | null;
}

type SignalKind = "offer" | "answer" | "ice";

interface Signal {
  kind: SignalKind;
  from: string;
  to: string;
  name: string;
  initials: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

function clock(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const base = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return h > 0 ? `${h}:${base}` : base;
}

function Tile({
  label,
  initials,
  stream,
  muted,
  isSelf,
  cameraOff,
}: {
  label: string;
  initials: string;
  stream: MediaStream | null;
  muted?: boolean;
  isSelf?: boolean;
  cameraOff?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  const hasVideo = !!stream && stream.getVideoTracks().some((t) => t.enabled) && !cameraOff;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-brand-navy/95 shadow-sm">
      <div className="aspect-video w-full">
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={muted}
          className={cn("h-full w-full object-cover", !hasVideo && "opacity-0")}
        />
        {!hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar className="size-16 border border-white/20">
              <AvatarFallback className="bg-white/10 text-lg font-semibold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        <span className="rounded-md bg-black/55 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
          {label}
          {isSelf ? " (you)" : ""}
        </span>
      </div>
    </div>
  );
}

export function MeetingRoom({ meeting }: { meeting: MeetingRecord }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isHost = !!user && meeting.host_id === user.id;

  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<PeerView[]>([]);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const cameraTrack = useRef<MediaStreamTrack | null>(null);
  const attendanceId = useRef<string | null>(null);
  const secondsRef = useRef(0);
  const initiated = useRef(false);

  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  useEffect(() => {
    if (!joined) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [joined]);

  const sendSignal = useCallback((signal: Signal) => {
    void channelRef.current?.send({ type: "broadcast", event: "signal", payload: signal });
  }, []);

  const upsertPeer = useCallback((peer: PeerView) => {
    setPeers((current) => {
      const next = current.filter((p) => p.id !== peer.id);
      return [...next, peer];
    });
  }, []);

  const dropPeer = useCallback((peerId: string) => {
    pcs.current.get(peerId)?.close();
    pcs.current.delete(peerId);
    setPeers((current) => current.filter((p) => p.id !== peerId));
  }, []);

  const ensurePeer = useCallback(
    (peerId: string, name: string, initials: string) => {
      const existing = pcs.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(ICE);
      pcs.current.set(peerId, pc);
      localRef.current?.getTracks().forEach((track) => pc.addTrack(track, localRef.current!));

      pc.onicecandidate = (event) => {
        if (!event.candidate || !user) return;
        sendSignal({
          kind: "ice",
          from: user.id,
          to: peerId,
          name: user.name,
          initials: user.avatarInitials,
          candidate: event.candidate.toJSON(),
        });
      };
      pc.ontrack = (event) => {
        const [stream] = event.streams;
        upsertPeer({ id: peerId, name, initials, stream: stream ?? null });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") dropPeer(peerId);
      };

      upsertPeer({ id: peerId, name, initials, stream: null });
      return pc;
    },
    [dropPeer, sendSignal, upsertPeer, user],
  );

  const handleSignal = useCallback(
    async (signal: Signal) => {
      if (!user || signal.to !== user.id) return;
      const pc = ensurePeer(signal.from, signal.name, signal.initials);
      try {
        if (signal.kind === "offer" && signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal({
            kind: "answer",
            from: user.id,
            to: signal.from,
            name: user.name,
            initials: user.avatarInitials,
            sdp: answer,
          });
        } else if (signal.kind === "answer" && signal.sdp) {
          if (pc.signalingState !== "stable") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          }
        } else if (signal.kind === "ice" && signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch {
        /* transient negotiation races are safe to ignore */
      }
    },
    [ensurePeer, sendSignal, user],
  );

  const join = useCallback(async () => {
    if (!user || connecting || joined) return;
    setConnecting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localRef.current = stream;
      cameraTrack.current = stream.getVideoTracks()[0] ?? null;
      setLocalStream(stream);

      const channel = supabase.channel(`meeting:${meeting.room_code}`, {
        config: { presence: { key: user.id }, broadcast: { self: false } },
      });
      channelRef.current = channel;

      channel.on("broadcast", { event: "signal" }, ({ payload }) => {
        void handleSignal(payload as Signal);
      });
      channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
        (leftPresences as { user_id?: string }[]).forEach((presence) => {
          if (presence.user_id) dropPeer(presence.user_id);
        });
      });
      channel.on("presence", { event: "sync" }, () => {
        if (initiated.current) return;
        initiated.current = true;
        const state = channel.presenceState<{ user_id: string; name: string; initials: string }>();
        Object.values(state)
          .flat()
          .filter((presence) => presence.user_id && presence.user_id !== user.id)
          .forEach(async (presence) => {
            const pc = ensurePeer(presence.user_id, presence.name, presence.initials);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal({
              kind: "offer",
              from: user.id,
              to: presence.user_id,
              name: user.name,
              initials: user.avatarInitials,
              sdp: offer,
            });
          });
      });

      await new Promise<void>((resolve) => {
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") resolve();
        });
        setTimeout(resolve, 4000);
      });
      await channel.track({ user_id: user.id, name: user.name, initials: user.avatarInitials });

      attendanceId.current = await recordJoin(meeting.id, user.id);
      if (isHost && meeting.status === "scheduled") {
        await updateMeeting(meeting.id, { status: "live", started_at: new Date().toISOString() });
      }
      setJoined(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? "We could not reach your camera or microphone. Please allow access and try again."
          : "Could not join the meeting.",
      );
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
      setLocalStream(null);
    } finally {
      setConnecting(false);
    }
  }, [connecting, dropPeer, ensurePeer, handleSignal, isHost, joined, meeting, sendSignal, user]);

  const cleanup = useCallback(() => {
    pcs.current.forEach((pc) => pc.close());
    pcs.current.clear();
    setPeers([]);
    localRef.current?.getTracks().forEach((track) => track.stop());
    localRef.current = null;
    setLocalStream(null);
    initiated.current = false;
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const leave = useCallback(
    async (endForEveryone = false) => {
      const attended = attendanceId.current;
      cleanup();
      setJoined(false);
      if (attended) await recordLeave(attended, secondsRef.current);
      attendanceId.current = null;
      if (endForEveryone && isHost) {
        await updateMeeting(meeting.id, { status: "ended", ended_at: new Date().toISOString() });
      }
      setSeconds(0);
      void navigate({ to: "/meetings" });
    },
    [cleanup, isHost, meeting.id, navigate],
  );

  useEffect(() => cleanup, [cleanup]);

  const toggleMute = () => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  };

  const toggleCamera = () => {
    const track = localRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOff(!track.enabled);
  };

  const replaceVideoTrack = useCallback((track: MediaStreamTrack | null) => {
    pcs.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender && track) void sender.replaceTrack(track);
    });
  }, []);

  const toggleShare = async () => {
    if (sharing) {
      replaceVideoTrack(cameraTrack.current);
      if (localRef.current && cameraTrack.current) {
        localRef.current.getVideoTracks().forEach((t) => {
          if (t !== cameraTrack.current) localRef.current?.removeTrack(t);
        });
        if (!localRef.current.getVideoTracks().includes(cameraTrack.current)) {
          localRef.current.addTrack(cameraTrack.current);
        }
        setLocalStream(new MediaStream(localRef.current.getTracks()));
      }
      setSharing(false);
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      if (!track) return;
      replaceVideoTrack(track);
      track.onended = () => {
        replaceVideoTrack(cameraTrack.current);
        setSharing(false);
      };
      if (localRef.current) {
        localRef.current.getVideoTracks().forEach((t) => localRef.current?.removeTrack(t));
        localRef.current.addTrack(track);
        setLocalStream(new MediaStream(localRef.current.getTracks()));
      }
      setSharing(true);
    } catch {
      toast.error("Screen sharing was cancelled.");
    }
  };

  const participantCount = peers.length + (joined ? 1 : 0);
  const tiles = useMemo(() => peers, [peers]);

  if (!joined) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-brand-navy/95 p-8 text-center text-white">
          <p className="text-xs font-semibold tracking-[0.2em] text-white/60 uppercase">Meeting room</p>
          <h2 className="mt-2 font-[Sora] text-2xl font-semibold">{meeting.title}</h2>
          <p className="mt-2 text-sm text-white/70">
            Your camera and microphone stay off until you join.
          </p>
          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => void join()} disabled={connecting} size="lg">
              {connecting ? "Connecting…" : "Join now"}
            </Button>
            <Button variant="secondary" size="lg" onClick={() => void navigate({ to: "/meetings" })}>
              Back to meetings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/70 p-4">
        <div className="min-w-0">
          <h2 className="truncate font-[Sora] text-lg font-semibold">{meeting.title}</h2>
          <p className="text-xs text-muted-foreground">
            Live for {clock(seconds)} · {participantCount} in the room
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="gap-1">
            <span className="size-1.5 animate-pulse rounded-full bg-white" /> Live
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Users className="size-3" /> {participantCount}
          </Badge>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-3",
          tiles.length === 0
            ? "grid-cols-1"
            : tiles.length === 1
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
        )}
      >
        <Tile
          label={user?.name ?? "You"}
          initials={user?.avatarInitials ?? "ME"}
          stream={localStream}
          muted
          isSelf
          cameraOff={cameraOff}
        />
        {tiles.map((peer) => (
          <Tile key={peer.id} label={peer.name} initials={peer.initials} stream={peer.stream} />
        ))}
      </div>

      {tiles.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Waiting for others to join — share the meeting link from the meeting details.
        </p>
      )}

      <div className="sticky bottom-4 mx-auto flex w-fit items-center gap-2 rounded-full border border-border/50 bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
        <Button variant={muted ? "destructive" : "secondary"} size="icon" onClick={toggleMute} aria-label="Toggle microphone">
          {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </Button>
        <Button
          variant={cameraOff ? "destructive" : "secondary"}
          size="icon"
          onClick={toggleCamera}
          aria-label="Toggle camera"
        >
          {cameraOff ? <VideoOff className="size-4" /> : <Video className="size-4" />}
        </Button>
        <Button
          variant={sharing ? "default" : "secondary"}
          size="icon"
          onClick={() => void toggleShare()}
          aria-label="Share screen"
        >
          {sharing ? <ScreenShareOff className="size-4" /> : <MonitorUp className="size-4" />}
        </Button>
        <Button variant="destructive" className="gap-2" onClick={() => void leave(false)}>
          <PhoneOff className="size-4" /> Leave
        </Button>
        {isHost && (
          <Button variant="outline" onClick={() => void leave(true)}>
            End for all
          </Button>
        )}
      </div>
    </div>
  );
}
