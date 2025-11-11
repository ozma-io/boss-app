import React from 'react';
import Svg, { Rect, Path } from 'react-native-svg';

interface TimelineIconProps {
  color: string;
  opacity: number;
}

export function TimelineIcon({ color, opacity }: TimelineIconProps) {
  return (
    <Svg width={20} height={21} viewBox="0 0 20 21" fill="none" opacity={opacity}>
      <Rect
        x={1.6665}
        y={2.5166}
        width={16.6667}
        height={15.8333}
        rx={3}
        stroke={color}
        strokeWidth={1.7}
      />
      <Path
        d="M5.8335 0.850098V2.51676"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.1665 0.850098V2.51676"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M1.6665 6.68311H18.3332"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5.4165 10.8501H6.24984"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.5835 10.8501H10.4168"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.75 10.8501H14.5833"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5.4165 14.1831H6.24984"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.5835 14.1831H10.4168"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.75 14.1831H14.5833"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

