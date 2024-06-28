'use client';

import React,{ useRef } from 'react';
import { useUser } from '..';
import { PredefinedMessageCard } from '../components/message-cards/predefined-message-card';
import { UserAvatar } from '../components/elements/user-avatar';
import { useState } from 'react';
import { FormWarningText } from '../components/elements/form-warning';
import { getPasswordError } from '@stackframe/stack-shared/dist/helpers/password';
import {Pencil2Icon} from "@radix-ui/react-icons";
import {Slider,Modal, Sheet} from '@mui/joy';
import AvatarEditor from "react-avatar-editor";
import imageCompression from 'browser-image-compression';
import { Button, Card, CardContent, CardFooter, CardHeader, Container, Input, Label, PasswordInput, Typography, cn } from '@stackframe/stack-ui';

function SettingSection(props: {
  title: string, 
  desc: string, 
  buttonText?: string, 
  buttonDisabled?: boolean,
  onButtonClick?: React.ComponentProps<typeof Button>["onClick"],
  buttonVariant?: 'default' | 'secondary',
  children?: React.ReactNode, 
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <Typography type='h4'>{props.title}</Typography>
          <Typography type='label' variant='secondary'>{props.desc}</Typography>
        </div>
      </CardHeader>
      {props.children && <CardContent>
        <div className='flex flex-col gap-4'>
          {props.children}
        </div>
      </CardContent>}
      {props.buttonText && <CardFooter>
        <div className='flex justify-end w-full'>
          <Button
            disabled={props.buttonDisabled}
            onClick={props.onButtonClick}
            variant={props.buttonVariant}
          >
            {props.buttonText}
          </Button>
        </div>
      </CardFooter>}
    </Card>
  );
}

function ProfileSection() {
  const user = useUser();
  const [userInfo, setUserInfo] = useState<{ displayName: string }>({ displayName: user?.displayName || '' });
  const [changed, setChanged] = useState(false);
  const [open,setOpen]=useState(false);
  const [slideValue, setSlideValue] = useState(10);
  const cropRef = useRef<AvatarEditor>(null);
  const [uploadAvatar,setUploadAvatar]=useState('');
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const handleImageUpload = () => {
    if (fileUploadRef.current) {
    fileUploadRef.current.click();
    }
  };
  const uploadImageDisplay =  () => {
    if (fileUploadRef.current?.files) {
      const uploadedFile = fileUploadRef.current.files[0];
      const maxSizeInBytes = (1 * 1024 * 1024)/2;
      let options={};
      if (uploadedFile.size < maxSizeInBytes){
        options={
          fileType:"image/jpeg",
        };
      }
      else {
        options = {
          maxSizeMB: 0.5,
          fileType:"image/jpeg",
        };
      }
      imageCompression(uploadedFile, options)
        .then(compressedFile => readFileAsDataURL(compressedFile))
        .then(fileData => {
        setUploadAvatar(fileData);
        setOpen(true);
        })
        .catch(error => {
        console.error('Image processing failed:', error);
        });
    }
  };
  const readFileAsDataURL = (file: File): Promise<string>=> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };
  const handleSliderChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    setSlideValue(Number(target.value));
  };
  const handleSave = async () => {
    if (cropRef.current) {
      const dataUrl = cropRef.current.getImage().toDataURL('image/jpeg');
      if (user){
        const uploadedImageData={
          "userId":user.id,
          "projectId":user.projectId,
          "image":dataUrl
        };
        const saveProfileImage=await user.saveUserProfileImage(uploadedImageData);
      }
    setOpen(false);
    setUploadAvatar(dataUrl);
    setSlideValue(10);
    }
  };
  return (
    <SettingSection
      title='Profile'
      desc='Your profile information'
      buttonDisabled={!changed}
      buttonText='Save'
      onButtonClick={async () => {
        await user?.update(userInfo);
        setChanged(false);
      }}
    >
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <UserAvatar user={user} size={50}/>
          <input type="file" id="file" ref={fileUploadRef} accept="image/*" onChange={uploadImageDisplay} hidden/>
          <div 
            onClick={handleImageUpload} 
            style={{ 
              position: 'absolute', 
              bottom: 0, 
              right: 0, 
              cursor: 'pointer',
              border: 'none', 
            }}
          >
            <Pencil2Icon className="h-4 w-4"/>
          </div>
        </div>
        <Modal
          aria-labelledby="modal-title"
          aria-describedby="modal-desc"
          open={open}
          onClose={() => setOpen(false)}
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',  
            outline: 'none' 
          }}
        >
          <Sheet
            variant="outlined"
            sx={{
              maxWidth: 500,
              borderRadius: 'md',
              p: 3,
              boxShadow: 'lg',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              textAlign: 'center'
            }}
          >
            <AvatarEditor
              ref={cropRef}
              image={uploadAvatar || ""}
              style={{ width: "100%", height: "100%", outline: 'none' }}
              borderRadius={150}
              color={[0, 0, 0, 0.72]}
              scale={slideValue / 10}
              rotate={0}
            />
            <Slider
              min={10}
              max={50}
              sx={{
                margin: "20px auto",
                width: "80%",
                color: "cyan",
                display: 'block'
              }}
              defaultValue={slideValue}
              value={slideValue}
              onChange={handleSliderChange}
            />
            <Button variant="warning" onClick={() => setOpen(false)} style={{marginRight: '120px'}}>
            Cancel
            </Button>
            <Button variant="primary"
              onClick={handleSave}  style={{marginLeft: '120px'}}
            >
            Save
            </Button>
          </Sheet>
        </Modal>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Text>{user?.displayName}</Text>
          <Text variant='secondary' size='sm'>{user?.primaryEmail}</Text>
      <div className='flex gap-4 items-center'>
        <UserAvatar user={user} size={50}/>
        <div className='flex flex-col'>
          <Typography>{user?.displayName}</Typography>
          <Typography variant='secondary' type='label'>{user?.primaryEmail}</Typography>
        </div>
      </div>

      <div className='flex flex-col'>
        <Label htmlFor='display-name' className='mb-1'>Display Name</Label>
        <Input
          id='display-name'
          value={userInfo.displayName}
          onChange={(e) => {
            setUserInfo((i) => ({...i, displayName: e.target.value }));
            setChanged(true);
          }}
        />
      </div>
    </SettingSection>
  );
}

function EmailVerificationSection() {
  const user = useUser();
  const [emailSent, setEmailSent] = useState(false);

  return (
    <SettingSection
      title='Email Verification'
      desc='We want to make sure that you own the email address.'
      buttonDisabled={emailSent}
      buttonText={
        !user?.primaryEmailVerified ? 
          emailSent ? 
            'Email sent!' : 
            'Send Email'
          : undefined
      }
      onButtonClick={async () => {
        await user?.sendVerificationEmail();
        setEmailSent(true);
      }}
    >
      {user?.primaryEmailVerified ? 
        <Typography variant='success'>Your email has been verified</Typography> :
        <Typography variant='destructive'>Your email has not been verified</Typography>}
    </SettingSection>
  );
}

function PasswordSection() {
  const user = useUser();
  const [oldPassword, setOldPassword] = useState<string>('');
  const [oldPasswordError, setOldPasswordError] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newPasswordError, setNewPasswordError] = useState<string>('');

  if (!user?.hasPassword) {
    return null;
  }

  return (
    <SettingSection
      title='Password'
      desc='Change your password here.'
      buttonDisabled={!oldPassword || !newPassword}
      buttonText='Save'
      onButtonClick={async () => {
        if (oldPassword && newPassword) {
          const errorMessage = getPasswordError(newPassword);
          if (errorMessage) {
            setNewPasswordError(errorMessage.message);
          } else {
            const errorCode = await user.updatePassword({ oldPassword, newPassword });
            if (errorCode) {
              setOldPasswordError('Incorrect password');
            } else {
              setOldPassword('');
              setNewPassword('');
            }
          }
        } else if (oldPassword && !newPassword) {
          setNewPasswordError('Please enter a new password');
        } else if (newPassword && !oldPassword) {
          setOldPasswordError('Please enter your old password');
        }
      }}
    >
      <div className='flex flex-col'>
        <Label htmlFor='old-password' className='mb-1'>Old Password</Label>
        <PasswordInput
          id='old-password' 
          value={oldPassword} 
          onChange={(e) => {
            setOldPassword(e.target.value);
            setOldPasswordError('');
          }}
        />
        <FormWarningText text={oldPasswordError} />
      </div>
      <div className='flex flex-col'>
        <Label htmlFor='new-password' className='mb-1'>New Password</Label>
        <PasswordInput
          id='new-password' 
          value={newPassword} 
          onChange={(e) => {
            setNewPassword(e.target.value);
            setNewPasswordError('');
          }}
        />
        <FormWarningText text={newPasswordError} />
      </div>
    </SettingSection>
  );
}

function SignOutSection() {
  const user = useUser();
  return (
    <SettingSection
      title='Sign out'
      desc='Sign out of your account on this device.'
      buttonVariant='secondary'
      buttonText='Sign Out'
      onButtonClick={() => user?.signOut()}
    >
    </SettingSection>
  );
}

export function AccountSettings({ fullPage=false }: { fullPage?: boolean }) {
  const user = useUser();
  if (!user) {
    return <PredefinedMessageCard type='signedOut' fullPage={fullPage} />;
  }

  const inner = (
    <div className={cn(fullPage ? 'p-4' : '', 'flex flex-col gap-4')}>
      <div>
        <Typography type='h2'>Account Settings</Typography>
        <Typography variant='secondary' type='label'>Manage your account</Typography>
      </div>
      
      <ProfileSection />
      <EmailVerificationSection />
      <PasswordSection />
      <SignOutSection />
    </div>
  );

  if (fullPage) {
    return (
      <Container size={600} className='stack-scope'>
        {inner}
      </Container>
    );
  } else {
    return inner;
  }
}
