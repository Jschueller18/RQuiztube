import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Code, 
  Atom, 
  Landmark, 
  BarChart3, 
  Calculator, 
  Languages,
  TrendingUp,
  Flame,
  Brain
} from "lucide-react";

interface ProgressChartsProps {
  stats: {
    totalVideos: number;
    totalQuizzes: number;
    averageScore: number;
    streakDays: number;
    retentionRate: number;
  };
  categoryPerformance?: Record<string, number>;
}

const categoryIcons: Record<string, any> = {
  programming: Code,
  science: Atom,
  history: Landmark,
  business: BarChart3,
  mathematics: Calculator,
  languages: Languages,
};

const categoryColors: Record<string, string> = {
  programming: "bg-education-blue",
  science: "bg-learning-green", 
  history: "bg-review-orange",
  business: "bg-youtube-red",
  mathematics: "bg-purple-500",
  languages: "bg-pink-500",
};

export default function ProgressCharts({ stats, categoryPerformance = {} }: ProgressChartsProps) {
  const weeklyGoalProgress = Math.min((stats.totalQuizzes % 20) / 20 * 100, 100);

  return (
    <div className="space-y-8">
      {/* Subject Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Subject Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(categoryPerformance).map(([category, score]) => {
              const Icon = categoryIcons[category] || Code;
              const colorClass = categoryColors[category] || "bg-gray-500";
              const percentage = Math.round(score * 100);
              
              return (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 ${colorClass} bg-opacity-10 rounded-lg flex items-center justify-center`}>
                      <Icon className={`${colorClass.replace('bg-', 'text-')}`} size={16} />
                    </div>
                    <span className="font-medium capitalize">{category}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Progress value={percentage} className="w-32" />
                    <span className="text-sm font-medium text-gray-600 w-10">{percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Weekly Goal */}
        <Card>
          <CardContent className="p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Weekly Goal</h4>
            <div className="flex items-center justify-center mb-4">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    stroke="#E5E7EB" 
                    strokeWidth="8" 
                    fill="none"
                  />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    stroke="#1976D2" 
                    strokeWidth="8" 
                    fill="none"
                    strokeLinecap="round" 
                    strokeDasharray="251.2" 
                    strokeDashoffset={251.2 - (weeklyGoalProgress / 100) * 251.2}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-900">
                    {Math.round(weeklyGoalProgress)}%
                  </span>
                </div>
              </div>
            </div>
            <p className="text-center text-sm text-gray-600">
              {stats.totalQuizzes % 20} of 20 quizzes completed this week
            </p>
          </CardContent>
        </Card>

        {/* Study Streak */}
        <Card>
          <CardContent className="p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Study Streak</h4>
            <div className="text-center">
              <div className="text-3xl font-bold text-youtube-red mb-2">
                {stats.streakDays}
              </div>
              <p className="text-sm text-gray-600">days in a row</p>
              <div className="flex justify-center mt-4 space-x-1">
                {Array.from({ length: 7 }, (_, i) => (
                  <div
                    key={i}
                    className={`w-6 h-6 rounded-full ${
                      i < stats.streakDays ? "bg-learning-green" : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Knowledge Retention */}
        <Card>
          <CardContent className="p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Knowledge Retention</h4>
            <div className="text-center">
              <div className="text-3xl font-bold text-learning-green mb-2">
                {Math.round(stats.retentionRate)}%
              </div>
              <p className="text-sm text-gray-600">average retention rate</p>
              <div className="mt-4 flex items-center justify-center space-x-2">
                <TrendingUp className="text-learning-green" size={16} />
                <span className="text-sm text-learning-green">
                  +15% from last month
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Learning Progress Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Learning Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center text-gray-500">
              <BarChart3 className="mx-auto mb-4" size={48} />
              <p className="font-medium">Interactive progress chart</p>
              <p className="text-sm mt-2">
                Shows retention rates, quiz scores, and learning trends over time
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
