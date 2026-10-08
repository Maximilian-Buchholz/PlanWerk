import { useLocalSearchParams, useRouter } from 'expo-router';

import { MessageScreen } from '@/components/message-screen';
import { getCurrentProfile, getCurrentUserId } from '@/lib/auth';
import { sendDirectMessage } from '@/lib/friends';

export default function MessageRoute() {
  const router = useRouter();
  const { friendId, friendName, friendColor } = useLocalSearchParams<{
    friendId: string;
    friendName?: string;
    friendColor?: string;
  }>();

  return (
    <MessageScreen
      recipient={{
        id: friendId,
        full_name: friendName || null,
        avatar_color: friendColor || '#8E8D8F',
      }}
      onBack={() => router.back()}
      onSend={async (body) => {
        const userId = await getCurrentUserId();
        if (!userId) return;
        const profile = await getCurrentProfile();
        await sendDirectMessage({
          senderId: userId,
          senderName: profile?.full_name ?? null,
          recipientId: friendId,
          body,
        });
        // The screen shows a "gesendet" confirmation and closes itself via onBack.
      }}
    />
  );
}
