import React from 'react';
import { ColumnsContainer as BaseColumnsContainer } from '@usewaypoint/block-columns-container';
import { ReaderBlock } from '../../reader/core';
import { ColumnsContainerProps } from './columns-container-props-schema';

export default function ColumnsContainerReader({ style, props }: ColumnsContainerProps) {
  const { columns, ...restProps } = props ?? {};
  let cols = undefined;
  if (columns) {
    cols = columns.map((col) => col.childrenIds.map((childId) => <ReaderBlock key={childId} id={childId} />));
  }

  return <BaseColumnsContainer props={restProps} columns={cols} style={style} />;
}
