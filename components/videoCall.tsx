// VideoCall.tsx
import React, { useEffect, useRef, useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import {
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView
} from "react-native-webrtc";
import io from "socket.io-client";

const SOCKET_SERVER_URL = "http://192.168.1.63:3000"; // change if needed
const ICE_SERVERS = [
  { urls: "stun:192.168.1.63:3478" }, // your local STUN
  // { urls: "stun:stun.l.google.com:19302" } // fallback
];

const socket = io(SOCKET_SERVER_URL, {
  transports: ["websocket"],
  forceNew: true,
  reconnection: true,
});

export default function VideoCall() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [myId, setMyId] = useState<string>("");
  const [remoteId, setRemoteId] = useState<string>("");
  const [users, setUsers] = useState<string[]>([]);

  // RTCPeerConnection ref (create when starting camera / call)
  const pcRef = useRef<RTCPeerConnection | null>(null);

  // pending ICE candidates received before remoteDescription is set
  const pendingCandidatesRef = useRef<any[]>([]);

  // ------------------ Socket listeners ------------------
  useEffect(() => {
    // connect event (socket.io native)
    socket.on("connect", () => {
      console.log("[socket] connect:", socket.id);
      // server also emits "connected", but set local id here too
      setMyId(socket.id??"");
    });

    // custom 'connected' event from server (server sends socket.id too)
    socket.on("connected", (id: string) => {
      console.log("[socket] connected event:", id);
      setMyId(id);
    });

    // generic signaling event from server
    socket.on("signal", async (data: any) => {
      console.log("[socket] signal recv:", data?.type, "from", data?.from);
      const { type, from } = data;

      // Ensure we have a peer connection (create one if not yet)
      if (!pcRef.current) {
        console.log("[pc] creating PC because signal arrived and no PC present");
        await createPeerConnection();
      }

      const pc = pcRef.current!;
      try {
        if (type === "offer") {
          // remote offer -> setRemoteDescription -> create answer -> send answer
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          // drain pending ICE (if any) after remote desc is set
          drainPendingCandidates();

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("signal", {
            to: from,
            data: { type: "answer", answer: answer }
          });
        } else if (type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          drainPendingCandidates();
        } else if (type === "ice") {
          const candidate = data.candidate;
          // if remoteDescription not set yet, queue
          if (!pc.remoteDescription || !pc.remoteDescription.type) {
            pendingCandidatesRef.current.push(candidate);
          } else {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
      } catch (err) {
        console.warn("[signal handler] error:", err);
      }
    });

    // users list
    socket.on("users", (list: string[]) => {
      console.log("[socket] users:", list);
      setUsers(list);
    });

    // cleanup on unmount
    return () => {
      socket.off("connect");
      socket.off("connected");
      socket.off("signal");
      socket.off("users");
    };
  }, []);

  // ------------------ PeerConnection creation ------------------
  const createPeerConnection = async () => {
    // close existing if any
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {}
      pcRef.current = null;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS } as any);

    // when remote track arrives
    (pc as any).ontrack = (event: any) => {
      console.log("[pc] ontrack", event?.streams?.[0]);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // ICE candidate gathered locally
    (pc as any).onicecandidate = (event: any) => {
      if (event.candidate) {
        console.log("[pc] local ICE candidate:", event.candidate.candidate);
        // only send ICE if we have a remoteId selected
        if (remoteId) {
          socket.emit("signal", {
            to: remoteId,
            data: { type: "ice", candidate: event.candidate }
          });
        } else {
          console.log("[pc] remoteId not set yet - candidate not sent, consider storing or warn user");
        }
      }
    };

    // optionally log connection state
    (pc as any).onconnectionstatechange = () => {
      console.log("[pc] connectionState:", (pc as any).connectionState);
    };

    pcRef.current = pc;

    // if local stream already exists, add tracks
    if (localStream) {
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    }

    return pc;
  };

  // Drain pending ICE candidates queued earlier
  const drainPendingCandidates = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    if (pendingCandidatesRef.current.length === 0) return;
    console.log("[pc] draining pending ICE:", pendingCandidatesRef.current.length);
    for (const cand of pendingCandidatesRef.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn("[pc] addIceCandidate failed:", e);
      }
    }
    pendingCandidatesRef.current = [];
  };

  // ------------------ Start camera & create pc ------------------
  const startCamera = async () => {
    try {
      const stream = await mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);

      // create pc if not exists
      const pc = pcRef.current ?? (await createPeerConnection());
      // add tracks
      stream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, stream);
        } catch (e) {
          console.warn("addTrack error:", e);
        }
      });
    } catch (err) {
      console.warn("startCamera error:", err);
    }
  };

  // ------------------ Start call (create offer) ------------------
  const callUser = async () => {
    if (!remoteId) {
      console.warn("Select a remoteId to call");
      return;
    }

    // ensure pc exists & local tracks added
    const pc = pcRef.current ?? (await createPeerConnection());

    // create a data channel to guarantee ICE gathering begins (optional)
    // create a data channel to trigger ICE gathering early
try {
  if (!(pc as any)._hasDataChannel) {
    const dc = pc.createDataChannel("chat");
    (pc as any)._hasDataChannel = true;

    (dc as any).onopen = () => console.log("[dc] open");
    (dc as any).onmessage = (ev: any) =>
      console.log("[dc] msg", ev.data);
  }
} catch (e) {
  console.warn("dataChannel create failed:", e);
}


    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // send offer via signaling server
      socket.emit("signal", {
        to: remoteId,
        data: { type: "offer", offer: offer }
      });
    } catch (err) {
      console.warn("callUser error:", err);
    }
  };

  // ------------------ Cleanup on unmount ------------------
  useEffect(() => {
    return () => {
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch (e) {}
        pcRef.current = null;
      }
      try {
        socket.disconnect();
      } catch (e) {}
    };
  }, []);

  // ------------------ Render ------------------
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Live Video Call</Text>
      <Text style={styles.idBox}>Your ID: {myId || "connecting..."}</Text>

      <View style={styles.videoBox}>
        {localStream ? (
          <RTCView streamURL={localStream.toURL()} style={styles.video} />
        ) : (
          <Text style={{ color: "#999", padding: 10 }}>Local camera stopped</Text>
        )}
      </View>

      <View style={[styles.videoBox, { backgroundColor: "#333" }]}>
        {remoteStream ? (
          <RTCView streamURL={remoteStream.toURL()} style={styles.video} />
        ) : (
          <Text style={{ color: "#999", padding: 10 }}>Waiting for remote</Text>
        )}
      </View>

      <Button title="Start Camera" onPress={startCamera} />

      <Button title="Start Call" onPress={callUser} disabled={!remoteId} />

      <TextInput
        placeholder="Enter remote ID"
        value={remoteId}
        onChangeText={setRemoteId}
        style={styles.input}
      />

      <View style={{ marginTop: 8 }}>
        {users
          .filter((id) => id !== myId)
          .map((id) => (
            <View key={id} style={{ marginVertical: 4 }}>
              <Button title={`Call: ${id}`} onPress={() => setRemoteId(id)} />
            </View>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  heading: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  idBox: { fontSize: 16, marginBottom: 10 },
  videoBox: { height: 200, backgroundColor: "#222", marginVertical: 5 },
  video: { width: "100%", height: "100%" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginVertical: 10,
  },
});
