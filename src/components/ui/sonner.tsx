"use client"

import { CheckCircle, CircleNotch, Info, Warning, WarningOctagon } from "@phosphor-icons/react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useTheme } from "@/hooks/use-theme"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="top-center"
      icons={{
        success: <CheckCircle weight="fill" className="size-4 text-success" />,
        info: <Info weight="fill" className="size-4" />,
        warning: <Warning weight="fill" className="size-4" />,
        error: <WarningOctagon weight="fill" className="size-4 text-destructive" />,
        loading: <CircleNotch className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
