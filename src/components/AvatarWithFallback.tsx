import React, { useState } from 'react';
import { User } from 'lucide-react';

interface AvatarWithFallbackProps {
  src?: string;
  alt: string;
  sizeClass?: string;
}

export const AvatarWithFallback: React.FC<AvatarWithFallbackProps> = ({
  src,
  alt,
  sizeClass = 'w-11 h-11',
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-stone-200 text-stone-600 flex items-center justify-center shrink-0 border border-stone-300`}
        aria-label={alt}
      >
        <User className="w-5 h-5" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-full object-cover shrink-0 border border-stone-200 bg-stone-100`}
    />
  );
};
