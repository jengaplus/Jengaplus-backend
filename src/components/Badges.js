import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Badges({ badges = [] }) {
  return (
    <View style={styles.container}>
      {badges.map((b, idx) => (
        <View key={idx} style={styles.badge}>
          <Text style={styles.badgeText}>{b.title}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { backgroundColor: 'rgba(250,204,21,0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginRight: 8 },
  badgeText: { color: '#FACC15', fontWeight: '700' }
});
