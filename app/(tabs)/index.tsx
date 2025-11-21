import VideoCall from "@/components/videoCall";
import { View } from 'react-native';

export default function HomeScreen() {
  return (
   <View style = {{flex: 1}}>
    <VideoCall />
   </View>
  );
}
