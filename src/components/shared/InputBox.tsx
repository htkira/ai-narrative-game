import { type KeyboardEvent } from 'react';
import { UI } from '@/utils/assets';
import styles from './InputBox.module.css';

interface InputBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function InputBox({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  className,
}: InputBoxProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      onSubmit?.();
    }
  };

  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      <img src={UI.inputBox} alt="" className={styles.skin} draggable={false} />
      <input
        type="text"
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}
