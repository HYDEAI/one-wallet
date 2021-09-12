import { Space, Tooltip, Typography} from 'antd'
import { Hint, Label } from './Text'
import React, { forwardRef, useState, useEffect} from 'react'
import { useWindowDimensions } from '../util'
import { QuestionCircleOutlined } from '@ant-design/icons'
const { Title } = Typography


const otpLength = 4;

const getAppleWatchOtpCode = () =>{
    let digits='0123456789';
    let OTP = '';
    for (let i =0;i<otpLength;i++){
        OTP += digits[Math.floor(Math.random()*10)];
    }
    return OTP;
} 

const countDown = (seconds) =>{
    if (seconds==0){
        return 30
    }
    return seconds - 1
}

const AppleWatchOtp= ({ onChange, value, inputStyle, ...params }, ref) => {
  const { isMobile } = useWindowDimensions()
  const [seconds, setSeconds] = useState(30);
  const [appleWatchOtpCode, updateOtp] = useState(getAppleWatchOtpCode());
  useEffect(()=>{
      const interval = setInterval(()=>{
          setSeconds(seconds=>countDown(seconds));
      },1000);
      return() => clearInterval(interval);
  },[]);

  useEffect(()=>{
      const otpInterval = setInterval(()=>{
        updateOtp(appleWatchOtpCode =>getAppleWatchOtpCode());
      },30000);
      return() => clearInterval(otpInterval);
  },[]);
  return (
    <Space align='baseline' size='large' style={{marginTop:16, width:'100%' }}>
        <Label><Hint>Apple Watch Code</Hint></Label>
        <Title
            id='apple-watch-verify'
            level={4}
            style={{ width: 200, textAlign: 'right', marginBottom: 0 }}
        >{appleWatchOtpCode}</Title>
        <Tooltip title={`You will be prompted to enter a code on your apple watch`}>
        <QuestionCircleOutlined />
        (New code in {seconds})
        </Tooltip>
    </Space>
  )
}

export default forwardRef(AppleWatchOtp)
