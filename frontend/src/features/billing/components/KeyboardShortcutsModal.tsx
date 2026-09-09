import React from 'react';
import { Keyboard } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal/Modal';
import { Button } from '../../../components/ui/Button/Button';

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const shortcuts = [
    { key: 'Ctrl + K  /  ⌘ + K', desc: 'Focus Product Search input field' },
    { key: 'Ctrl + Enter  /  ⌘ + ↵', desc: 'Complete Bill and submit sale' },
    { key: 'Esc', desc: 'Close any open modal / drawer' },
    { key: 'F2', desc: 'Start New Bill and reset cart' },
    { key: 'Enter (on card)', desc: 'Add selected product to cart' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="POS Keyboard Shortcuts"
      size="sm"
      footer={
        <Button variant="secondary" onClick={onClose} autoFocus>
          Got it
        </Button>
      }
    >
      <div className="pos-shortcuts-modal-content">
        <div className="pos-shortcuts-header">
          <Keyboard size={32} className="pos-shortcuts-icon" />
          <p>Speed up cashier billing with high-speed keyboard navigation:</p>
        </div>

        <div className="pos-shortcuts-list">
          {shortcuts.map((sc, i) => (
            <div key={i} className="pos-shortcut-row">
              <span className="pos-shortcut-desc">{sc.desc}</span>
              <kbd className="pos-shortcut-key">{sc.key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};
