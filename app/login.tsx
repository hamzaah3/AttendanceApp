import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/context/AuthContext';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      Alert.alert('Login failed', e instanceof Error ? e.message : 'Please check your credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.inner}>
        <Text style={[styles.title, { color: c.text }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>Sign in to track your attendance</Text>
        <TextInput
          style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
          placeholder="Email"
          placeholderTextColor={c.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
          placeholder="Password"
          placeholderTextColor={c.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Link href="/forgot-password" asChild>
          <Text style={[styles.link, { color: c.primary }]}>Forgot password?</Text>
        </Link>
        <TouchableOpacity style={[styles.button, { backgroundColor: c.primary }]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>
        <Link href="/register" asChild>
          <Text style={[styles.footer, { color: c.text }]}>Don't have an account? <Text style={{ color: c.primary }}>Sign up</Text></Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 32 },
  input: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16, fontSize: 16 },
  link: { alignSelf: 'flex-end', marginBottom: 24, fontSize: 14 },
  button: { borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: { textAlign: 'center', fontSize: 14 },
});
