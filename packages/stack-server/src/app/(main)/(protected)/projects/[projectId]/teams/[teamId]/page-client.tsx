"use client";

import React from 'react';
import { Paragraph } from "@/components/paragraph";
import { MemberTable } from './member-table';
import { useAdminApp } from '../../use-admin-app';
import { notFound } from 'next/navigation';


export default function ClientPage(props: { teamId: string }) {
  const stackAdminApp = useAdminApp();
  const team = stackAdminApp.useTeam(props.teamId);
  const users = team?.useUsers();

  if (!team) {
    return notFound();
  }
  
  return (
    <>
      <Paragraph h1>
        {team.displayName}
      </Paragraph>

      <Paragraph body>
        <MemberTable rows={users || []} />
      </Paragraph>
    </>
  );
}