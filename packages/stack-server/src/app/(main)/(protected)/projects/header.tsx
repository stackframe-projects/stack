"use client";;
import { Logo } from "@/components/logo";
import { Sheet, SheetProps, Stack } from "@mui/joy";

export function Header(props: SheetProps & { headerHeight: number }) {
  const { headerHeight, ...sheetProps } = props;

  return (
    <Sheet
      variant="outlined"
      component="header"
      {...sheetProps}
      sx={{
        paddingX: 1,
        position: 'sticky',
        top: 0,
        zIndex: 30,
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        display: 'flex',
        alignItems: 'stretch',
        height: `${headerHeight}px`,
        ...(sheetProps.sx ?? {}),
      }}
    >
      <Stack sx={{ marginLeft: 2, justifyContent: 'center', height: headerHeight - 1 }}>
        <Logo full height={24} href="/projects" />
      </Stack>
    </Sheet>
  );
}
