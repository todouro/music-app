import type { SVGProps } from 'react'

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string
  className?: string
  color?: string
}

// App Logo / Sound Waves Solid Mark
export function AudioLinesFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect x="2.5" y="8" width="3" height="8" rx="1.5" />
      <rect x="7.5" y="4.5" width="3" height="15" rx="1.5" />
      <rect x="12.5" y="2" width="3" height="20" rx="1.5" />
      <rect x="17.5" y="6" width="3" height="12" rx="1.5" />
    </svg>
  )
}

// Solid Vinyl / CD Disc
export function DiscFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm0 5.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
      />
    </svg>
  )
}

// Solid Playlist / Library Icon
export function PlaylistFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect x="3" y="4.5" width="12" height="2.8" rx="1.4" />
      <rect x="3" y="10.5" width="9.5" height="2.8" rx="1.4" />
      <rect x="3" y="16.5" width="7" height="2.8" rx="1.4" />
      <path d="M19.5 7.5a2.5 2.5 0 0 0-2.5 2.5v6.2A2.8 2.8 0 1 0 19.5 18.5V10h2.5a1 1 0 0 0 0-2h-2.5Z" />
    </svg>
  )
}

// Solid Heart
export function HeartFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z" />
    </svg>
  )
}

// Heart Outline
export function HeartOutline({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z" />
    </svg>
  )
}

// Solid Play
export function PlayFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M7 4.88c0-1.52 1.66-2.45 2.96-1.66l11.4 6.94a1.95 1.95 0 0 1 0 3.34L9.96 20.44C8.66 21.23 7 20.3 7 18.78V4.88Z" />
    </svg>
  )
}

// Solid Pause
export function PauseFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect x="5.5" y="4" width="4.5" height="16" rx="2" />
      <rect x="14" y="4" width="4.5" height="16" rx="2" />
    </svg>
  )
}

// Solid Skip Next
export function SkipForwardFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M5 4.93c0-1.47 1.62-2.38 2.87-1.62l9.2 5.56a1.9 1.9 0 0 1 0 3.26l-9.2 5.56C6.62 18.45 5 17.54 5 16.07V4.93ZM18.5 4a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 1 1-3 0v-13A1.5 1.5 0 0 1 18.5 4Z" />
    </svg>
  )
}

// Solid Skip Previous
export function SkipBackFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M19 19.07c0 1.47-1.62 2.38-2.87 1.62l-9.2-5.56a1.9 1.9 0 0 1 0-3.26l9.2-5.56C17.38 5.55 19 6.46 19 7.93v11.14ZM5.5 20a1.5 1.5 0 0 1-1.5-1.5v-13a1.5 1.5 0 1 1 3 0v13A1.5 1.5 0 0 1 5.5 20Z" />
    </svg>
  )
}

// Solid Shuffle
export function ShuffleFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17.5 4a1 1 0 0 0 0 2h1.6l-4.14 4.14a1.2 1.2 0 1 0 1.7 1.7L20.8 7.7V9.5a1 1 0 1 0 2 0V4.5a.5.5 0 0 0-.5-.5h-4.8Zm-13 1a1.25 1.25 0 0 0 0 2.5h2.1c1.38 0 2.68.64 3.52 1.74l5.36 6.96a6.9 6.9 0 0 0 5.48 2.8h1.24v1.5a1 1 0 1 0 2 0v-4.5a.5.5 0 0 0-.5-.5h-4.74a1 1 0 1 0 0 2h2.2l-3.9-5.06a6.9 6.9 0 0 0-5.48-2.8H4.5Zm0 11.5a1.25 1.25 0 0 0 0 2.5h2.1a6.9 6.9 0 0 0 3.2-1.04 1.2 1.2 0 1 0-1.34-1.99 4.5 4.5 0 0 1-1.86.53H4.5Z"
      />
    </svg>
  )
}

// Solid Repeat
export function RepeatFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M6 4a3 3 0 0 0-3 3v4a1.5 1.5 0 0 0 3 0V7.5a.5.5 0 0 1 .5-.5h10.3l-1.9 1.9a1.2 1.2 0 1 0 1.7 1.7l3.9-3.9a1.2 1.2 0 0 0 0-1.7l-3.9-3.9a1.2 1.2 0 1 0-1.7 1.7l1.9 1.9H6.5A3 3 0 0 0 6 4Zm12 16a3 3 0 0 0 3-3v-4a1.5 1.5 0 0 0-3 0v3.5a.5.5 0 0 1-.5.5H7.2l1.9-1.9a1.2 1.2 0 0 0-1.7-1.7l-3.9 3.9a1.2 1.2 0 0 0 0 1.7l3.9 3.9a1.2 1.2 0 1 0 1.7-1.7L7.2 20h10.3c.17 0 .34 0 .5 0Z" />
    </svg>
  )
}

// Solid Repeat One
export function RepeatOneFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M6 4a3 3 0 0 0-3 3v4a1.5 1.5 0 0 0 3 0V7.5a.5.5 0 0 1 .5-.5h10.3l-1.9 1.9a1.2 1.2 0 1 0 1.7 1.7l3.9-3.9a1.2 1.2 0 0 0 0-1.7l-3.9-3.9a1.2 1.2 0 1 0-1.7 1.7l1.9 1.9H6.5A3 3 0 0 0 6 4Zm12 16a3 3 0 0 0 3-3v-4a1.5 1.5 0 0 0-3 0v3.5a.5.5 0 0 1-.5.5H7.2l1.9-1.9a1.2 1.2 0 0 0-1.7-1.7l-3.9 3.9a1.2 1.2 0 0 0 0 1.7l3.9 3.9a1.2 1.2 0 1 0 1.7-1.7L7.2 20h10.3c.17 0 .34 0 .5 0Z" />
      <path d="M12.5 9.5a1 1 0 0 0-1.6-.8l-1.4.9a1 1 0 1 0 1.1 1.7l.4-.25V14.5a1 1 0 1 0 2 0v-5Z" />
    </svg>
  )
}

// Solid Volume Icon
export function VolumeFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M11.3 3.3a1.5 1.5 0 0 0-1.6.2L4.8 7.5H3a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h1.8l4.9 4c.4.35.9.5 1.4.5.7 0 1.4-.4 1.7-1a1.6 1.6 0 0 0 .2-.9V4.9c0-.7-.4-1.3-1-1.6Zm6.7 3.5a1.25 1.25 0 0 0-1.77 1.77 5.5 5.5 0 0 1 0 7.78 1.25 1.25 0 1 0 1.77 1.77 8 8 0 0 0 0-11.32Zm2.83-2.83a1.25 1.25 0 0 0-1.77 1.77 11.5 11.5 0 0 1 0 16.26 1.25 1.25 0 1 0 1.77 1.77 14 14 0 0 0 0-19.8Z" />
    </svg>
  )
}

// Solid Folder Plus (Music folder)
export function FolderMusicFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M3 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8.59l-2-2H3Z" />
      <path
        fill="#090a0a"
        d="M12 11a1 1 0 0 1 1 1v1.5h1.5a1 1 0 1 1 0 2H13V17a1 1 0 1 1-2 0v-1.5H9.5a1 1 0 1 1 0-2H11V12a1 1 0 0 1 1-1Z"
      />
    </svg>
  )
}

// Solid Folder Open / Images
export function FolderImageFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M2.5 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h19a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8.5l-2-2H2.5Z" />
      <circle cx="16" cy="11.5" r="1.5" fill="#090a0a" />
      <path fill="#090a0a" d="M7 17l3.2-3.8a1 1 0 0 1 1.5 0L13.5 15l1.7-2.1a1 1 0 0 1 1.5 0l2.3 2.8a.8.8 0 0 1-.6 1.3H7.6a.8.8 0 0 1-.6-1Z" />
    </svg>
  )
}

// Solid Upload / Add Single File
export function UploadFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M12 2.2a1.5 1.5 0 0 1 1.06.44l4.5 4.5a1.5 1.5 0 0 1-2.12 2.12L13.5 7.38V15a1.5 1.5 0 0 1-3 0V7.38L8.56 9.26A1.5 1.5 0 0 1 6.44 7.14l4.5-4.5A1.5 1.5 0 0 1 12 2.2ZM3 16.5a1.5 1.5 0 0 1 1.5 1.5v1a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-1a1.5 1.5 0 0 1 3 0v1A4 4 0 0 1 18.5 23h-13A4 4 0 0 1 1.5 19v-1a1.5 1.5 0 0 1 1.5-1.5Z" />
    </svg>
  )
}

// Solid Search
export function SearchFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.5 2a8.5 8.5 0 1 0 5.17 15.25l4.24 4.24a1.5 1.5 0 0 0 2.12-2.12l-4.24-4.24A8.5 8.5 0 0 0 10.5 2Zm-5.5 8.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z"
      />
    </svg>
  )
}

// Solid Edit Pencil
export function PencilFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M19.7 5.42a2.4 2.4 0 0 0-3.39 0l-1.58 1.58 3.39 3.39 1.58-1.58a2.4 2.4 0 0 0 0-3.39ZM3 17.61V21h3.39l9.96-9.96-3.39-3.39L3 17.61Z" />
    </svg>
  )
}

// Solid Trash Can
export function TrashFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M15 3a1.5 1.5 0 0 1 1.4 1h3.1a1.25 1.25 0 1 1 0 2.5H4.5a1.25 1.25 0 0 1 0-2.5h3.1A1.5 1.5 0 0 1 9 3h6ZM5.5 8.5a1 1 0 0 1 1 1v8.5a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V9.5a1 1 0 1 1 2 0v8.5a4 4 0 0 1-4 4h-7a4 4 0 0 1-4-4V9.5a1 1 0 0 1 1-1Zm4.5 3a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-5a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-5a1 1 0 0 1 1-1Z" />
    </svg>
  )
}

// Solid Close X
export function CloseFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M18.7 5.3a1.2 1.2 0 0 0-1.7 0L12 10.3 7 5.3A1.2 1.2 0 0 0 5.3 7l5 5-5 5a1.2 1.2 0 1 0 1.7 1.7l5-5 5 5a1.2 1.2 0 0 0 1.7-1.7l-5-5 5-5a1.2 1.2 0 0 0 0-1.7Z" />
    </svg>
  )
}

// Solid Checkmark
export function CheckFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M20.3 5.3a1.2 1.2 0 0 1 0 1.7l-10 10.5a1.2 1.2 0 0 1-1.7 0l-5-5.2a1.2 1.2 0 1 1 1.7-1.7l4.15 4.35L18.6 5.3a1.2 1.2 0 0 1 1.7 0Z" />
    </svg>
  )
}

// Solid Plus
export function PlusFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M12 3a1.5 1.5 0 0 1 1.5 1.5V10.5H19.5a1.5 1.5 0 0 1 0 3H13.5V19.5a1.5 1.5 0 0 1-3 0V13.5H4.5a1.5 1.5 0 0 1 0-3H10.5V4.5A1.5 1.5 0 0 1 12 3Z" />
    </svg>
  )
}

// Solid Chevron Down
export function ChevronDownFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M12 15.5a1.2 1.2 0 0 1-.85-.35l-6-6a1.2 1.2 0 1 1 1.7-1.7L12 12.6l5.15-5.15a1.2 1.2 0 1 1 1.7 1.7l-6 6a1.2 1.2 0 0 1-.85.35Z" />
    </svg>
  )
}

// Solid Image Icon
export function ImageFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M4 2a4 4 0 0 0-4 4v12a4 4 0 0 0 4 4h16a4 4 0 0 0 4-4V6a4 4 0 0 0-4-4H4Zm14 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3 18l4.8-6.1a1.5 1.5 0 0 1 2.3 0L13 15.4l2.8-3.7a1.5 1.5 0 0 1 2.4 0L21 15.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  )
}

// Refresh / Rescan icon
export function RefreshFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  )
}

// Settings / Gear icon
export function SettingsFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2 4a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.484.484 0 0 0 13.9 2h-3.8c-.24 0-.45.17-.48.41l-.38 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.72 8.47c-.13.22-.08.49.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.8c.24 0 .45-.17.48-.41l.38-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.49-.12-.61l-2.01-1.58Z"
      />
    </svg>
  )
}

// Looks / Palette icon
export function PaletteFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M12 2C6.49 2 2 6.49 2 12c0 4.41 3.59 8 8 8 1.1 0 2-.9 2-2 0-.46-.16-.89-.42-1.24-.26-.35-.42-.78-.42-1.26 0-1.1.9-2 2-2h2.34C18.66 13.5 22 10.16 22 6c0-2.21-.89-4.21-2.34-5.66C17.71 2.89 15.21 2 12 2Zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11Zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4s1.5.67 1.5 1.5S10.33 7 9.5 7Zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4s1.5.67 1.5 1.5S15.33 7 14.5 7Zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5Z" />
    </svg>
  )
}

// Sparkles / Ambient glow icon
export function SparklesFilled({ size = 20, className, color = 'currentColor', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M12 2.5l1.6 4.7a1.5 1.5 0 0 0 1.2 1.2l4.7 1.6-4.7 1.6a1.5 1.5 0 0 0-1.2 1.2l-1.6 4.7-1.6-4.7a1.5 1.5 0 0 0-1.2-1.2l-4.7-1.6 4.7-1.6a1.5 1.5 0 0 0 1.2-1.2L12 2.5z" />
      <path d="M19 16l.8 2.2a.8.8 0 0 0 .6.6l2.2.8-2.2.8a.8.8 0 0 0-.6.6L19 23.2l-.8-2.2a.8.8 0 0 0-.6-.6L15.4 19.6l2.2-.8a.8.8 0 0 0 .6-.6L19 16z" />
    </svg>
  )
}


