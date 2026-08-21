import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator } from 'react-native';

export default function VoiceAssistant({ onCommand, apiBase, authToken }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);

  const sendText = async () => {
    if (!text) return;
    setLoading(true);
    try {
      const res = await fetch(`${String(apiBase || '').replace(/\/$/, '')}/voice/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      setResponse(data.answer || JSON.stringify(data));
      if (onCommand) onCommand(text);
    } catch (err) {
      setResponse(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Assistant (Beta)</Text>
      <Text style={styles.hint}>Type a command (or integrate STT) and press Send</Text>
      <TextInput value={text} onChangeText={setText} style={styles.input} placeholder="e.g. Show sales for last month" placeholderTextColor="#94A3B8" />
      <TouchableOpacity style={styles.button} onPress={sendText} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send</Text>}
      </TouchableOpacity>
      {response ? <Text style={styles.response}>{response}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12 },
  title: { color: '#F8FAFC', fontWeight: '700', marginBottom: 6 },
  hint: { color: '#94A3B8', marginBottom: 12 },
  input: { backgroundColor: 'rgba(255,255,255,0.02)', color: '#fff', padding: 8, borderRadius: 8, marginBottom: 8 },
  button: { backgroundColor: '#10B981', padding: 10, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  response: { color: '#E6E6E6', marginTop: 10 }
});
