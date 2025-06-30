import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import Navigation from "@/components/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Save, Settings as SettingsIcon } from "lucide-react";

const preferencesSchema = z.object({
  learningGoals: z.string().optional(),
  preferredCategories: z.array(z.string()).optional(),
  reviewFrequency: z.enum(["daily", "every-2-3-days", "weekly"]).optional(),
  notificationSettings: z.object({
    quizReminders: z.boolean(),
    newVideoAnalysis: z.boolean(),
    weeklyProgress: z.boolean(),
  }).optional(),
});

type PreferencesFormData = z.infer<typeof preferencesSchema>;

const availableCategories = [
  { id: "programming", label: "Programming" },
  { id: "science", label: "Science" },
  { id: "history", label: "History" },
  { id: "business", label: "Business" },
  { id: "mathematics", label: "Mathematics" },
  { id: "languages", label: "Languages" },
];

const reviewFrequencyOptions = [
  { id: "daily", label: "Daily reminders (recommended)" },
  { id: "every-2-3-days", label: "Every 2-3 days" },
  { id: "weekly", label: "Weekly only" },
];

export default function Settings() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const form = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      learningGoals: "",
      preferredCategories: [],
      reviewFrequency: "daily",
      notificationSettings: {
        quizReminders: true,
        newVideoAnalysis: true,
        weeklyProgress: false,
      },
    },
  });

  // Load user data and populate form
  useEffect(() => {
    if (user) {
      form.reset({
        learningGoals: user.learningGoals || "",
        preferredCategories: user.preferredCategories || [],
        reviewFrequency: (user.reviewFrequency as any) || "daily",
        notificationSettings: user.notificationSettings || {
          quizReminders: true,
          newVideoAnalysis: true,
          weeklyProgress: false,
        },
      });
    }
  }, [user, form]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: PreferencesFormData) => {
      const response = await apiRequest("PUT", "/api/user/preferences", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Preferences Updated",
        description: "Your learning preferences have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PreferencesFormData) => {
    updatePreferencesMutation.mutate(data);
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-youtube-red mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center space-x-3 mb-8">
          <SettingsIcon className="h-8 w-8 text-gray-700" />
          <h1 className="text-3xl font-bold text-gray-900">Learning Preferences</h1>
        </div>
        
        <Card>
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Learning Goals */}
                <FormField
                  control={form.control}
                  name="learningGoals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xl font-semibold text-gray-900">
                        What do you want to learn from your YouTube videos?
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your learning goals... (e.g., 'I want to learn advanced JavaScript concepts, React patterns, and modern web development practices')"
                          className="resize-none min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Content Categories */}
                <FormField
                  control={form.control}
                  name="preferredCategories"
                  render={() => (
                    <FormItem>
                      <FormLabel className="text-xl font-semibold text-gray-900">
                        Preferred Content Categories
                      </FormLabel>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {availableCategories.map((category) => (
                          <FormField
                            key={category.id}
                            control={form.control}
                            name="preferredCategories"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={category.id}
                                  className="flex items-center space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <label className="flex items-center p-4 border border-gray-300 rounded-lg hover:border-education-blue hover:bg-blue-50 transition-colors cursor-pointer w-full">
                                      <Checkbox
                                        checked={field.value?.includes(category.id)}
                                        onCheckedChange={(checked) => {
                                          const currentValue = field.value || [];
                                          if (checked) {
                                            field.onChange([...currentValue, category.id]);
                                          } else {
                                            field.onChange(
                                              currentValue.filter((value) => value !== category.id)
                                            );
                                          }
                                        }}
                                      />
                                      <span className="ml-3">{category.label}</span>
                                    </label>
                                  </FormControl>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Review Frequency */}
                <FormField
                  control={form.control}
                  name="reviewFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xl font-semibold text-gray-900">
                        Review Frequency
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="space-y-3"
                        >
                          {reviewFrequencyOptions.map((option) => (
                            <div key={option.id} className="flex items-center space-x-2">
                              <RadioGroupItem value={option.id} id={option.id} />
                              <Label htmlFor={option.id} className="cursor-pointer">
                                {option.label}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Notification Settings */}
                <FormField
                  control={form.control}
                  name="notificationSettings"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xl font-semibold text-gray-900">
                        Notification Settings
                      </FormLabel>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">Quiz Reminders</p>
                            <p className="text-sm text-gray-600">Get notified when it's time to review</p>
                          </div>
                          <Switch
                            checked={field.value?.quizReminders}
                            onCheckedChange={(checked) =>
                              field.onChange({
                                ...field.value,
                                quizReminders: checked,
                              })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">New Video Analysis</p>
                            <p className="text-sm text-gray-600">When quizzes are ready for new videos</p>
                          </div>
                          <Switch
                            checked={field.value?.newVideoAnalysis}
                            onCheckedChange={(checked) =>
                              field.onChange({
                                ...field.value,
                                newVideoAnalysis: checked,
                              })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">Weekly Progress</p>
                            <p className="text-sm text-gray-600">Summary of your learning progress</p>
                          </div>
                          <Switch
                            checked={field.value?.weeklyProgress}
                            onCheckedChange={(checked) =>
                              field.onChange({
                                ...field.value,
                                weeklyProgress: checked,
                              })
                            }
                          />
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={updatePreferencesMutation.isPending}
                    className="bg-education-blue hover:bg-education-dark-blue px-8 py-3"
                  >
                    {updatePreferencesMutation.isPending ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Save className="h-4 w-4" />
                        <span>Save Preferences</span>
                      </div>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
