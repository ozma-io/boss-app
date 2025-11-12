import Svg, { G, Line, Path } from 'react-native-svg';

interface BackArrowIconProps {
  size?: number;
  color?: string;
  opacity?: number;
}

export function BackArrowIcon({ 
  size = 24, 
  color = '#161616', 
  opacity = 0.6 
}: BackArrowIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G opacity={opacity}>
        <Path 
          d="M9.71729 5L3.00021 12L9.71729 19" 
          stroke={color} 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
        <Line 
          x1="1" 
          y1="-1" 
          x2="16.7331" 
          y2="-1" 
          transform="matrix(1 0 0 -1 3.26709 11.0317)" 
          stroke={color} 
          strokeWidth="2" 
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}

