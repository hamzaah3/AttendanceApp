import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/context/AuthContext';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  async function handleReset() {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      Alert.alert('Check your email', 'Password reset link has been sent.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.inner}>
        <Text style={[styles.title, { color: c.text }]}>Reset password</Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>Enter your email to receive a reset link</Text>
        <TextInput
          style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
          placeholder="Email"
          placeholderTextColor={c.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TouchableOpacity style={[styles.button, { backgroundColor: c.primary }]} onPress={handleReset} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send reset link</Text>}
        </TouchableOpacity>
        <Link href="/login" asChild>
          <Text style={StyleSheet.flatten([styles.footer, { color: c.primary }])}>Back to sign in</Text>
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
  input: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 24, fontSize: 16 },
  button: { borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: { textAlign: 'center', fontSize: 14 },
});
