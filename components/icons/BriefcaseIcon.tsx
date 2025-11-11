import React from 'react';
import Svg, { G, Rect, Path, Defs, ClipPath } from 'react-native-svg';

interface BriefcaseIconProps {
  color: string;
  opacity: number;
}

export function BriefcaseIcon({ color, opacity }: BriefcaseIconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none" opacity={opacity}>
      <G clipPath="url(#clip0_328_10933)">
        <Rect
          x={0.833496}
          y={5}
          width={18.3333}
          height={13.3333}
          rx={3}
          stroke={color}
          strokeWidth={1.7}
        />
        <Path
          d="M13.3332 4.99984V3.6665C13.3332 2.56193 12.4377 1.6665 11.3332 1.6665H8.6665C7.56193 1.6665 6.6665 2.56193 6.6665 3.6665V4.99984"
          stroke={color}
          strokeWidth={1.7}
        />
        <Path
          d="M0.833496 11.6665C0.833496 11.6665 4.90757 14.1665 10.0002 14.1665C15.0928 14.1665 19.1668 11.6665 19.1668 11.6665"
          stroke={color}
          strokeWidth={1.7}
        />
        <Path
          d="M9.1665 10H10.8332"
          stroke={color}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
      <Defs>
        <ClipPath id="clip0_328_10933">
          <Rect width={20} height={20} fill="white" />
        </ClipPath>
      </Defs>
    </Svg>
  );
}

