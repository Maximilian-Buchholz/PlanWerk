import { useRouter } from 'expo-router';
import { RegisterScreen } from '@/components/register-screen';
import { registerUser } from "@/lib/auth";

export default function RegisterRoute() {
  const router = useRouter();

  return (
    <RegisterScreen
      onLogin={() => router.back()}
      onSubmit={async ({ name, email, password }) => {
        await registerUser({ name, email, password });
        // Erfolgreich registriert: zurück zum Login, damit sich der Nutzer
        // mit den gerade angelegten Zugangsdaten anmelden kann.
        router.replace('/');
      }}
    />
  );
}
