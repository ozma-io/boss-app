import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ProfileIconProps {
  color: string;
  opacity: number;
}

export function ProfileIcon({ color, opacity }: ProfileIconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none" opacity={opacity}>
      <Path
        d="M2.5 17.9167L2.58214 17.3886C2.79072 16.0477 3.66466 14.8964 4.9679 14.5183C6.27729 14.1384 8.08427 13.75 10 13.75C11.9157 13.75 13.7227 14.1384 15.0321 14.5183C16.3353 14.8964 17.2093 16.0477 17.4179 17.3886L17.5 17.9167"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.0002 9.99984C12.3013 9.99984 14.1668 8.13436 14.1668 5.83317C14.1668 3.53198 12.3013 1.6665 10.0002 1.6665C7.69898 1.6665 5.8335 3.53198 5.8335 5.83317C5.8335 8.13436 7.69898 9.99984 10.0002 9.99984Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

