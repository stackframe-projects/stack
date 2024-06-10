'use client';

import React from 'react';
import { PasswordField, useUser } from '..';
import PredefinedMessageCard from '../components/message-cards/predefined-message-card';
import { Text, Label, Input, Button, Card, CardHeader, CardContent, CardFooter, Container } from "../components-core";
import UserAvatar from '../components/user-avatar';
import { useState } from 'react';
import FormWarningText from '../components/form-warning';
import { getPasswordError } from '@stackframe/stack-shared/dist/helpers/password';

function SettingSection(props: {
  title: string, 
  desc: string, 
  buttonText?: string, 
  buttonDisabled?: boolean,
  onButtonClick?: React.ComponentProps<typeof Button>["onClick"],
  buttonVariant?: 'primary' | 'secondary',
  children?: React.ReactNode, 
}) {
  return (
    <Card>
      <CardHeader>
        <Text as='h3' style={{ fontWeight: 500 }}>{props.title}</Text>
        <Text variant='secondary' size='sm'>{props.desc}</Text>
      </CardHeader>
      {props.children && <CardContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {props.children}
        </div>
      </CardContent>}
      {props.buttonText && <CardFooter>
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
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
        <UserAvatar user={user} size={50}/>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Text>{user?.displayName}</Text>
          <Text variant='secondary' size='sm'>{user?.primaryEmail}</Text>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Label htmlFor='display-name'>Display Name</Label>
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
  const user = useUser({ or: 'redirect' });
  const [emailSent, setEmailSent] = useState(false);

  if (user.primaryEmailVerified) {
    return null;
  }

  return (
    <SettingSection
      title='Email Verification'
      desc='We want to make sure that you own the email address.'
      buttonDisabled={emailSent}
      buttonText={emailSent ? 'Email sent!' : 'Send Email'}
      onButtonClick={async () => {
        await user.sendVerificationEmail();
        setEmailSent(true);
      }}
    >
      <Text variant='warning'>Your email has not been verified</Text>
    </SettingSection>
  );
}

function OAuthSection() {
  const user = useUser({ or: 'redirect' });

  return (
    <SettingSection
      title='OAuth'
      desc='Manage your OAuth Sign-ins'
    >
      {user.oauthProviders.map((provider) => (
        <div key={provider}>
          <Text>{provider}</Text>
        </div>
      ))}
    </SettingSection>
  );
}

function PasswordSection() {
  const user = useUser({ or: 'redirect' });
  const [oldPassword, setOldPassword] = useState<string>('');
  const [oldPasswordError, setOldPasswordError] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newPasswordError, setNewPasswordError] = useState<string>('');

  if (!user.hasPassword) {
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
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Label htmlFor='old-password'>Old Password</Label>
        <PasswordField
          id='old-password' 
          value={oldPassword} 
          onChange={(e) => {
            setOldPassword(e.target.value);
            setOldPasswordError('');
          }}
        />
        <FormWarningText text={oldPasswordError} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Label htmlFor='new-password'>New Password</Label>
        <PasswordField
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

export default function AccountSettings({ fullPage=false }: { fullPage?: boolean }) {
  const user = useUser();
  if (!user) {
    return <PredefinedMessageCard type='signedOut' fullPage={fullPage} />;
  }

  const inner = (
    <div style={{ padding: fullPage ? '1rem' : 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <Text size="xl" as='h1' style={{ fontWeight: '600' }}>Account Settings</Text>
        <Text variant='secondary' size='sm'>Manage your account</Text>
      </div>
      
      <ProfileSection />
      <EmailVerificationSection />
      <OAuthSection />
      <PasswordSection />
      <SignOutSection />
    </div>
  );

  if (fullPage) {
    return (
      <Container size='sm'>
        {inner}
      </Container>
    );
  } else {
    return inner;
  }
}
