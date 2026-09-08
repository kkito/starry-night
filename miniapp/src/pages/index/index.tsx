import { View, Text } from '@tarojs/components';
import './index.scss';
// 验证性引用：证明 miniapp 可只读复用根共享算法（Task 2），不写业务。
import { computeSky } from '../../../../src/core/sky';

void computeSky;

export default function Index() {
  return (
    <View className="index">
      <Text>starry-night miniapp boot</Text>
    </View>
  );
}
