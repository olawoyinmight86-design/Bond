import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePartnerActivity } from '../lib/partnerActivity';
import { useAuth } from '../lib/auth';

const MESSAGE_VISIBLE_MS = 6000;

export default function PartnerActivityBubble() {
  const { profile } = useAuth();
  const { partnerDraft, partnerName, lastMessagePreview, bubbleDismissedAt } = usePartnerActivity();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  const onChatScreen = location.pathname === '/chat';

  useEffect(() => {
    if (!lastMessagePreview) return;
    setShowMessage(true);
    setCollapsed(false);
    const t = setTimeout(() => setShowMessage(false), MESSAGE_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [lastMessagePreview]);

  useEffect(() => {
    if (!partnerDraft) return;
    setCollapsed(false);
  }, [partnerDraft]);

  const active = !onChatScreen && !!profile?.paired_with && (!!partnerDraft || (showMessage && !!lastMessagePreview));
  const dismissedRecently = lastMessagePreview && lastMessagePreview.at < bubbleDismissedAt;

  if (!active || dismissedRecently) return null;

  const previewText = partnerDraft || lastMessagePreview?.text || '';
  const isTyping = !!partnerDraft;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
      <AnimatePresence mode="wait">
        {collapsed ? (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={() => navigate('/chat')}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface text-2xl shadow-float"
          >
            <span className="relative">
              💖
              {isTyping && <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-brand-500" />}
            </span>
          </motion.button>
        ) : (
          <motion.button
            key="expanded"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            onClick={() => navigate('/chat')}
            className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left shadow-float"
          >
            <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg">
              💖
              {isTyping && <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 animate-pulse rounded-full bg-brand-500 ring-2 ring-surface" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink-800">{partnerName}</p>
              <p className="truncate text-sm text-ink-500">
                {isTyping && <span className="mr-1 text-brand-500">typing…</span>}
                "{previewText.length > 40 ? previewText.slice(0, 40) + '…' : previewText}"
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setCollapsed(true); }}
              className="flex-shrink-0 text-ink-300"
            >
              ✕
            </button>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
