import { motion } from 'framer-motion'
import { StatusBanner } from '../StatusBanner'
import {
  AudioLinesFilled,
  CheckFilled,
  CloseFilled,
  FolderImageFilled,
  FolderMusicFilled,
} from '../icons'

export type FirstRunSetupModalProps = {
  step: 'music' | 'covers'
  musicFolderName?: string
  coverFolderName?: string
  busyAction?: 'music' | 'covers' | null
  onChooseMusicFolder: () => void
  onChooseCoverFolder: () => void
  onSkipMusic: () => void
  onSkipCoverArt: () => void
  onSetUpLater: () => void
}

export function FirstRunSetupModal({
  step,
  musicFolderName,
  coverFolderName,
  busyAction,
  onChooseMusicFolder,
  onChooseCoverFolder,
  onSkipMusic,
  onSkipCoverArt,
  onSetUpLater,
}: FirstRunSetupModalProps) {
  return (
    <motion.div
      className="modal-backdrop first-run-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-run-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="modal-card first-run-modal-card"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: 'spring', damping: 26, stiffness: 360 }}
      >
        <header className="modal-header first-run-header">
          <div className="first-run-brand-mark">
            <AudioLinesFilled size={22} />
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onSetUpLater}
            aria-label="Close setup"
            title="Set up later"
          >
            <CloseFilled size={17} />
          </button>
        </header>

        <div className="first-run-intro">
          <span className="first-run-eyebrow">WELCOME TO RESONANCE</span>
          <h2 id="first-run-title">
            {step === 'music' ? 'Let’s build your library.' : 'Make it look like your music.'}
          </h2>
          <p>
            {step === 'music'
              ? 'Choose the folder where you keep your songs. Resonance will scan it and keep your library on this device.'
              : musicFolderName
                ? 'Your music folder is ready. Add a folder of album covers for the best experience, or skip this step.'
                : 'Music import is skipped for now. You can still add a folder of album covers, or skip this step.'}
          </p>
        </div>

        <div className="first-run-steps" aria-label="Setup progress">
          <span className={step === 'music' ? 'first-run-step active' : 'first-run-step complete'}>
            {step === 'music' ? '1' : <CheckFilled size={13} />} Music folder
          </span>
          <span className={step === 'covers' ? 'first-run-step active' : 'first-run-step'}>
            2 Cover art
          </span>
        </div>

        {step === 'music' ? (
          <div className="first-run-folder-card">
            <div className="first-run-folder-icon">
              <FolderMusicFilled size={24} />
            </div>
            <div className="first-run-folder-copy">
              <strong>Music folder</strong>
              <span>Scan supported audio files in this folder and its subfolders.</span>
            </div>
            <button
              type="button"
              className="first-run-primary-btn"
              onClick={onChooseMusicFolder}
              disabled={Boolean(busyAction)}
            >
              {busyAction === 'music' ? 'Scanning…' : 'Choose folder'}
            </button>
          </div>
        ) : (
          <>
            {musicFolderName && (
              <StatusBanner
                variant="success"
                className="first-run-selected-folder"
                icon={<CheckFilled size={17} />}
                title="Music folder selected"
                description={musicFolderName}
              />
            )}

            <div className="first-run-folder-card">
              <div className="first-run-folder-icon cover">
                <FolderImageFilled size={24} />
              </div>
              <div className="first-run-folder-copy">
                <strong>Cover art folder <span className="first-run-recommended">Recommended</span></strong>
                <span>Match your songs with image files. Resonance keeps a local copy so covers continue to display.</span>
                {coverFolderName && <small>Current: {coverFolderName}</small>}
              </div>
              <button
                type="button"
                className="first-run-primary-btn"
                onClick={onChooseCoverFolder}
                disabled={Boolean(busyAction)}
              >
                {busyAction === 'covers' ? 'Importing…' : coverFolderName ? 'Change folder' : 'Choose folder'}
              </button>
            </div>
          </>
        )}

        <footer className="first-run-footer">
          <span>Your songs are not uploaded anywhere.</span>
          {step === 'covers' ? (
            <button type="button" className="first-run-secondary-btn" onClick={onSkipCoverArt} disabled={Boolean(busyAction)}>
              Skip cover art and finish
            </button>
          ) : (
            <button type="button" className="first-run-secondary-btn" onClick={onSkipMusic} disabled={Boolean(busyAction)}>
              Skip music folder
            </button>
          )}
        </footer>
      </motion.div>
    </motion.div>
  )
}

export default FirstRunSetupModal
