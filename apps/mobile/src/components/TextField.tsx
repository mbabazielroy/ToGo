import { forwardRef } from 'react';
import { View, Text, TextInput, type TextInputProps, type TextInputInstance } from 'react-native';
import { makeStyles, useColors, radius, font, space } from '@/theme';

/**
 * A labelled text input with an optional hint and an inline error that screen
 * readers announce. Use `bare` inside a Group, where the row itself is the field.
 */
export const TextField = forwardRef<TextInputInstance, TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
  bare?: boolean;
}>(function TextField({ label, hint, error, bare, style, ...input }, ref) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={bare ? styles.bareWrap : undefined}>
      <Text style={styles.label} nativeID={`${label}-label`}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.faint}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        aria-invalid={!!error}
        style={[bare ? styles.bareInput : styles.input, error ? styles.inputError : null, style]}
        {...input}
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const useStyles = makeStyles((colors) => ({
  bareWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  label: { fontSize: font.tiny, fontWeight: '600', color: colors.muted, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: font.body, color: colors.ink, minHeight: 48, backgroundColor: colors.surface },
  bareInput: { fontSize: font.body, color: colors.ink, paddingVertical: 6, minHeight: 40 },
  inputError: { borderColor: colors.red700 },
  error: { fontSize: font.tiny, color: colors.red700, marginTop: space.xs, lineHeight: 17 },
  hint: { fontSize: font.tiny, color: colors.muted, marginTop: space.xs, lineHeight: 17 },
}));
