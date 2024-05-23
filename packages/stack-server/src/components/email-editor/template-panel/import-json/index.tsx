import React, { useState } from 'react';

import { FileUploadOutlined } from '@mui/icons-material';

import ImportJsonDialog from './import-json-dialog';
import { Button } from '@/components/ui/button';

export default function ImportJson() {
  const [open, setOpen] = useState(false);

  let dialog = null;
  if (open) {
    dialog = <ImportJsonDialog onClose={() => setOpen(false)} />;
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant='secondary' className='gap-2'>
        <FileUploadOutlined fontSize="small" />
        Import JSON
      </Button>
      {dialog}
    </>
  );
}
