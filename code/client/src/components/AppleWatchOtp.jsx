import { Space, Tooltip, Typography, message} from 'antd'
import { Hint, Label } from './Text'
import React, { forwardRef, useState, useEffect} from 'react'
import { useWindowDimensions } from '../util'
import { QuestionCircleOutlined } from '@ant-design/icons'
const { Title } = Typography
import axios from 'axios'
import config from '.././config'

const otpLength = 4;

const getAppleWatchOtpCode = () =>{
    let digits='0123456789';
    let OTP = '';
    for (let i =0;i<otpLength;i++){
        OTP += digits[Math.floor(Math.random()*10)];
    }
    return OTP;
}

const setServerOtp = (setAppleWatchOtpCode, appleWatchDeviceId) =>{
    console.log('setting otp')
    let otp = getAppleWatchOtpCode()
    //Cloud functions not liking null
    if (appleWatchDeviceId == null){
        message.error('Device id not found!')
    }else{
        //Make API call to server
        const registerUrl = config.appleWatchOtpService.writeOtp.replace('{{deviceId}}',appleWatchDeviceId)+'&code='+otp+'&f=o'
        axios.get(registerUrl).then((status)=>{
            setAppleWatchOtpCode(otp)
        })
    }
}

const getSecondsUntilNextMinute = () => {
     return 60 - new Date().getSeconds(); }

const countDown = (seconds,setAppleWatchOtpCode,appleWatchDeviceId) =>{
    //Refresh every minute
    seconds = getSecondsUntilNextMinute()
    //Check if it's top of the hour
    if (seconds == 60){
        setServerOtp(setAppleWatchOtpCode,appleWatchDeviceId)
    }
    return getSecondsUntilNextMinute()
}

//Make auth call to server
const checkAppleWatchAuthentication = (setAppleWatchAuthenticated,appleWatchDeviceId,setAppleWatchOtpState)=>{
    const registerUrl = config.appleWatchOtpService.checkOtp.replace('{{deviceId}}',appleWatchDeviceId)+'&f=c'
    axios.get(registerUrl).then((status)=>{
        if(status.data.check === 1){
            setAppleWatchAuthenticated(true)
            setAppleWatchOtpState(true)
        }else{
            setAppleWatchAuthenticated(false)
            setAppleWatchOtpState(false)
        }
    })
}


const AppleWatchOtp= ({appleWatchDeviceId,setAppleWatchOtpState}) => {
  const { isMobile } = useWindowDimensions()
  const [seconds, setSeconds] = useState(60);
  const [appleWatchOtpCode, setAppleWatchOtpCode] = useState();
  const [appleWatchAuthenticated, setAppleWatchAuthenticated] = useState();
  const [runOnce, setRunOnce] = useState(true);
  if(runOnce){
    setAppleWatchOtpCode(setServerOtp(setAppleWatchOtpCode,appleWatchDeviceId))
    setRunOnce(false);
  }
  useEffect(()=>{
      const interval = setInterval(()=>{
          checkAppleWatchAuthentication(setAppleWatchAuthenticated, appleWatchDeviceId,setAppleWatchOtpState);
          setSeconds(seconds=>countDown(seconds,setAppleWatchOtpCode,appleWatchDeviceId));
      },1000);
      return() => clearInterval(interval);
  },[]);

  return (
    <Space align='baseline' size='large' style={{marginTop:16, width:'100%' }}>
        <Label><Hint>Apple Watch Code</Hint></Label>
        {!appleWatchAuthenticated &&
            <Space>
                <Title
                    id='apple-watch-verify'
                    level={4}
                    style={{ width: 200, textAlign: 'right', marginBottom: 0 }}
                >{appleWatchOtpCode}</Title>
                <Tooltip title={`You will be prompted to enter a code on your apple watch, code is updated every minute`}>
                <QuestionCircleOutlined />
                (New code in {seconds})
                </Tooltip>
            </Space>
        }
        {appleWatchAuthenticated &&
            <Space>
                Apple Watch authenticated ({seconds}). ✅
            </Space>

        }

    </Space>
  )
}

export default forwardRef(AppleWatchOtp)
