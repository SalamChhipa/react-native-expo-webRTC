// import React, { useEffect, useRef, useState } from "react";
// import { Button, StyleSheet, Text, TextInput, View } from "react-native";
// import {
//   mediaDevices,
//   MediaStream,
//   MediaStreamTrack,
//   RTCIceCandidate,
//   RTCPeerConnection,
//   RTCSessionDescription,
//   RTCView
// } from "react-native-webrtc";
// import io, { Socket } from "socket.io-client";

// // ⚠️ Change to your local IP
// const socket: Socket = io("http://192.168.1.63:3000");

// export default function VideoCall() {
//   const [localStream, setLocalStream] = useState<MediaStream | null>(null);
//   const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
//   const [myId, setMyId] = useState<string>("");
//   const [remoteId, setRemoteId] = useState<string>("");
//   const [users, setUsers] = useState<string[]>([]);

//   // const pc = useRef(
//   //   new RTCPeerConnection({ iceServers: [] })
//   // ).current;
//   const pc = useRef(
//     new RTCPeerConnection({
//       iceServers: [
//         { urls: "stun:stun.l.google.com:19302" }
//       ]
//     })
//   ).current;


//   // 🚀 Socket handling
//   useEffect(() => {
//     socket.on("connected", (id: string) => {
//       setMyId(id);
//       console.log("My ID:", id);
//     });

//     socket.on("signal", async (data: any) => {
//       const { type } = data;

//       if (type === "offer") {
//         await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

//         const answer = await pc.createAnswer();
//         await pc.setLocalDescription(answer);

//         socket.emit("signal", {
//           to: data.from,
//           data: { type: "answer", answer }
//         });
//       }

//       if (type === "answer") {
//         await pc.setRemoteDescription(
//           new RTCSessionDescription(data.answer)
//         );
//       }

//       if (type === "ice") {
//         await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
//       }
//     });
//   }, []);
//   useEffect(() => {
//   socket.on("users", (list) => {
//     setUsers(list.filter((id:any) => id !== myId));
//   });
// }, [myId]);

//   // 🚀 Start camera & add tracks
//   const startCamera = async () => {
//     const stream = await mediaDevices.getUserMedia({
//       video: true,
//       audio: true,
//     });

//     setLocalStream(stream);

//     stream.getTracks().forEach((track: MediaStreamTrack) =>
//       pc.addTrack(track, stream)
//     );

//     // TS fix: override type
//     (pc as any).ontrack = (event: any) => {
//       setRemoteStream(event.streams[0]);
//     };

//     (pc as any).onicecandidate = (event: any) => {
//       if (event.candidate) {
//         socket.emit("signal", {
//           to: remoteId,
//           data: { type: "ice", candidate: event.candidate },
//         });
//       }
//     };
//   };

//   // 🚀 Start call
//   const callUser = async () => {
//     const offer = await pc.createOffer();
//     await pc.setLocalDescription(offer);

//     socket.emit("signal", {
//       to: remoteId,
//       data: { type: "offer", offer }
//     });
//   };

//   return (
//     <View style={styles.container}>
//       <Text style={styles.heading}>Live Video Call</Text>
//       <Text>Your ID: {myId}</Text>

//       <View style={{ height: 200, backgroundColor: "#222" }}>
//         {localStream && (
//           <RTCView
//             streamURL={localStream.toURL()}
//             style={styles.video}
//           />
//         )}
//       </View>

//       <View style={{ height: 200, backgroundColor: "#444", marginTop: 10 }}>
//         {remoteStream && (
//           <RTCView
//             streamURL={remoteStream.toURL()}
//             style={styles.video}
//           />
//         )}
//       </View>

//       <Button title="Start Camera" onPress={startCamera} />

//       <Button
//         title="Start Call"
//         onPress={callUser}
//         disabled={!remoteId}
//       />

//       <TextInput
//         placeholder="Enter remote ID"
//         value={remoteId}
//         onChangeText={setRemoteId}
//         style={{
//           borderWidth: 1,
//           borderColor: '#ccc',
//           padding: 10,
//           marginVertical: 10
//         }}
//       />
//     {users.map((id) => (
//   <Button
//     key={id}
//     title={`Call: ${id}`}
//     onPress={() => setRemoteId(id)}
//   />
// ))}

//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     padding: 16
//   },
//   heading: {
//     fontSize: 20,
//     fontWeight: "bold",
//     marginBottom: 10
//   },
//   video: {
//     width: "100%",
//     height: "100%"
//   }
// });
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

const socket = io("http://192.168.1.63:3000");

export default function VideoCall() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [myId, setMyId] = useState("");
  const [remoteId, setRemoteId] = useState("");
  const [users, setUsers] = useState<string[]>([]);

  const pc = useRef(
    new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    })
  ).current;

  // 🚀 Initial Socket Events
  useEffect(() => {
    socket.on("connected", (id) => {
      setMyId(id);
      console.log("My ID:", id);
    });

    socket.on("signal", async (data) => {
      const { type } = data;

      if (type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("signal", {
          to: data.from,
          data: { type: "answer", answer }
        });
      }

      if (type === "answer") {
        await pc.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
      }

      if (type === "ice") {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });
  }, []);

  useEffect(() => {
    const handler = (list: string[]) => {
      setUsers(list.filter((id: string) => id !== myId));
    };

    socket.on("users", handler);

    return () => {
      socket.off("users", handler);
    };
  }, [myId]);


  // 🚀 Start camera
  const startCamera = async () => {
    const stream = await mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    setLocalStream(stream);

    stream.getTracks().forEach((track) =>
      pc.addTrack(track, stream)
    );

    (pc as any).ontrack = (event: any) => {
      setRemoteStream(event.streams[0]);
    };

    (pc as any).onicecandidate = (event: any) => {
      if (event.candidate) {
        socket.emit("signal", {
          to: remoteId,
          data: { type: "ice", candidate: event.candidate },
        });
      }
    };

  };

  // 🚀 Call user
  const callUser = async () => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("signal", {
      to: remoteId,
      data: { type: "offer", offer }
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Live Video Call</Text>
      <Text style={styles.idBox}>Your ID: {myId}</Text>

      <View style={styles.videoBox}>
        {localStream && <RTCView streamURL={localStream.toURL()} style={styles.video} />}
      </View>

      <View style={[styles.videoBox, { backgroundColor: "#333" }]}>
        {remoteStream && <RTCView streamURL={remoteStream.toURL()} style={styles.video} />}
      </View>

      <Button title="Start Camera" onPress={startCamera} />

      <Button
        title="Start Call"
        onPress={callUser}
        disabled={!remoteId}
      />

      <TextInput
        placeholder="Enter remote ID"
        value={remoteId}
        onChangeText={setRemoteId}
        style={styles.input}
      />

      {users.map((id) => (
        <Button
          key={id}
          title={`Call: ${id}`}
          onPress={() => setRemoteId(id)}
        />
      ))}
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
    marginVertical: 10
  }
});
