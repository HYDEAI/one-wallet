# one-wallet
See original one wallet instructions
https://github.com/polymorpher/one-wallet


This is a proof of concept adding SMS + Apple watch based authentication.
I make use of Google Cloud Functions, Firestore.  I also use 3rd party APIs like Twilio.
If you want to try the SMS, you'll need to send it to 
https://smsreceivefree.com/info/12498011843/
As it is a free twilio account, so the phone number needs to be registered before SMS can be sent.

In this project you'll see how to make use of Google Cloud, SMS sending services.  It also demonstrates how to add code to the 1wallet code base, updating the UI.


# Quick Start

0. Clone hyde-one-wallet, set up environment

    We assume you are on macOS or Linux. Windows is not supported as a development environment at this time.

    First, you need to install all essential dependencies and apply a patch to one of the dependencies. To do this, simply run the following at the root directory of this project:

```
      ./scripts/setup.sh
```



1. Run to start a local web and load a wallet in the browser 

    Next, try starting a local web client:
    
```
        cd code/client
        yarn run dev
```


2.	Create a wallet, click “Use your apple watch to confirm transactions” 


3.	Enter phone number and click “Send SMS code”


4.	Receive SMS code, register device


5.	Scan Google Authenticator and enter access code


6.	Confirm: Create Now


7.	To run Apple watch locally, follow steps

```
      $ export HWDEV=dev
      $ functions_framework - - source watch.py - -target main - - port:8084
```


   ![image](https://user-images.githubusercontent.com/86937126/135163613-98c2e3d9-38f1-43c8-a7a0-df7bf3c964cb.png)


8.	Enter the code shown on the screen 




# Create Functions on Google Cloud Platform

1.	Configuration
    Cloud functions > create function > add environment variables

    ![image](https://user-images.githubusercontent.com/86937126/135163719-95e100e3-0a1f-4ee7-a0b4-2132fb13d8d7.png)
    

    ![image](https://user-images.githubusercontent.com/86937126/135163727-b162e5a5-24e3-43c4-bdf6-d045e49377c5.png)
    

    ![image](https://user-images.githubusercontent.com/86937126/135163738-9ac13500-c1d3-422e-b3cc-70b2f52bae47.png)
    

2.	Code: copy and paste your code. Click DEPLOY


# DEMO video link:
