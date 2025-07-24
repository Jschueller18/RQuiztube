import { Button } from "@/components/ui/button";
import { Youtube, Play, Brain, BarChart3, Clock, CheckCircle } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-youtube-red rounded-lg flex items-center justify-center">
                <Play className="text-white text-sm fill-current" />
              </div>
              <span className="text-xl font-bold text-gray-900">QuizTube</span>
            </div>
            <Button 
              onClick={() => window.location.href = "/api/login"}
              className="bg-youtube-red hover:bg-youtube-dark-red"
            >
              Sign In
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="gradient-youtube text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Transform Your YouTube Learning
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-red-100 max-w-3xl mx-auto">
            Turn passive video watching into active learning with AI-generated quizzes and spaced repetition
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => window.location.href = "/api/login"}
              className="bg-white text-youtube-red hover:bg-gray-100 text-lg px-8 py-4"
            >
              <Youtube className="mr-2" />
              Connect YouTube Account
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => window.location.href = "/api/login"}
              className="border-2 border-white text-white hover:bg-white hover:text-youtube-red text-lg px-8 py-4"
            >
              Start Free Trial
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How QuizTube Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Our AI transforms your favorite educational YouTube videos into personalized learning experiences
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-education-blue bg-opacity-10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Youtube className="h-8 w-8 text-education-blue" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Analyze Videos</h3>
              <p className="text-gray-600">
                Paste any YouTube URL and our AI analyzes the content to extract key learning points
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-learning-green bg-opacity-10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Brain className="h-8 w-8 text-learning-green" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Generate Quizzes</h3>
              <p className="text-gray-600">
                AI creates personalized multiple-choice questions that test your understanding of the content
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-review-orange bg-opacity-10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-review-orange" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Spaced Repetition</h3>
              <p className="text-gray-600">
                Review questions at optimal intervals to maximize long-term knowledge retention
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Boost Your Learning Retention by 78%
              </h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-learning-green mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Active Learning</h4>
                    <p className="text-gray-600">Transform passive watching into active engagement</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-learning-green mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Personalized Content</h4>
                    <p className="text-gray-600">AI tailors questions to your learning goals and preferences</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-learning-green mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Progress Tracking</h4>
                    <p className="text-gray-600">Detailed analytics show your learning journey and improvements</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-education-blue mb-2">78%</div>
                  <p className="text-sm text-gray-600">Better Retention</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-learning-green mb-2">5x</div>
                  <p className="text-sm text-gray-600">More Engaging</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-review-orange mb-2">15min</div>
                  <p className="text-sm text-gray-600">Daily Practice</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-youtube-red mb-2">92%</div>
                  <p className="text-sm text-gray-600">User Satisfaction</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="gradient-youtube text-white py-16">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Learning?</h2>
          <p className="text-xl text-red-100 mb-8">
            Join thousands of learners who have boosted their knowledge retention with QuizTube
          </p>
          <Button
            size="lg"
            onClick={() => window.location.href = "/api/login"}
            className="bg-white text-youtube-red hover:bg-gray-100 text-lg px-8 py-4"
          >
            <Youtube className="mr-2" />
            Start Your Free Trial
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-youtube-red rounded-lg flex items-center justify-center">
                  <Play className="text-white text-sm fill-current" />
                </div>
                <span className="text-xl font-bold">QuizTube</span>
              </div>
              <p className="text-gray-400">
                Transform your YouTube learning with AI-powered quizzes and spaced repetition.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Free Trial</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Connect</h4>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 QuizTube. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
