import React, { useMemo } from 'react';
import { useDocument } from '../../documents/editor/editor-context';
import { Button } from '@/components/ui/button';
import { FileDownloadOutlined } from '@mui/icons-material';

export default function DownloadJson() {
  const doc = useDocument();
  const href = useMemo(() => {
    return `data:text/plain,${encodeURIComponent(JSON.stringify(doc, null, '  '))}`;
  }, [doc]);
  return (
    <Button 
      onClick={() => {
        const blob = new Blob([JSON.stringify(doc, null, '  ')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'emailTemplate.json';
        a.click();
        URL.revokeObjectURL(url);
      }}
      variant='secondary' 
      className='gap-2'
    >
      <FileDownloadOutlined fontSize="small" />
      Download JSON
    </Button>
  );
}
