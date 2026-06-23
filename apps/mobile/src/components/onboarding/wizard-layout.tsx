import * as React from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProgressHeader } from "@/components/ui/progress-header";

/**
 * Shared chrome for a wizard step: safe area, progress header, a scrollable body
 * for the step's fields, and a pinned footer (usually the primary "Next"/"Submit"
 * button). One step is shown at a time — "one thing per screen".
 */
export function WizardLayout({
  step,
  total,
  title,
  onBack,
  footer,
  children,
}: {
  step: number;
  total: number;
  title: string;
  onBack?: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 px-6 pt-2">
          <ProgressHeader
            step={step}
            total={total}
            title={title}
            onBack={onBack}
          />
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: 16, gap: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          <View className="py-4">{footer}</View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
