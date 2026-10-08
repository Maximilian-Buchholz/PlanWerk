import { useRouter } from 'expo-router';

import { LoginScreen } from '@/components/login-screen';
import { signInUser } from '@/lib/auth';

export default function LoginRoute() {
  const router = useRouter();

  return (
    <LoginScreen
      onCreateAccount={() => router.push('/register')}
      onSubmit={async ({ email, password }) => {
        await signInUser({ email, password });
        // Erfolgreich angemeldet: zum Dashboard des Users (Tasks-Übersicht).
        // replace statt push, damit "zurück" nicht wieder zum Login führt.
        router.replace('/tasks');
      }}
    />
  );
}
