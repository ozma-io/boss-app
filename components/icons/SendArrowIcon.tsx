import * as React from 'react';
import Svg, { Line, Path } from 'react-native-svg';

interface SendArrowIconProps {
  size?: number;
  color?: string;
  testID?: string;
}

export const SendArrowIcon: React.FC<SendArrowIconProps> = ({ 
  size = 20, 
  color = 'white',
  testID 
}) => {
  return (
    <Svg 
      width={size} 
      height={size} 
      viewBox="0 0 20 20" 
      fill="none"
      testID={testID}
    >
      <Path
        d="M4.1665 8.09766L9.99984 2.5001L15.8332 8.09766"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="9.94336"
        y1="3.47266"
        x2="9.94336"
        y2="16.7502"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
};

