import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Bell, User, Play } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Navigation() {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-youtube-red rounded-lg flex items-center justify-center">
              <Play className="text-white text-sm fill-current" />
            </div>
            <Link href="/">
              <span className="text-xl font-bold text-gray-900 cursor-pointer">QuizTube</span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className={`transition-colors ${
              location === "/" 
                ? "text-youtube-red" 
                : "text-gray-700 hover:text-youtube-red"
            }`}>
              Library
            </Link>
            <Link href="/dashboard" className={`transition-colors ${
              location === "/dashboard" 
                ? "text-youtube-red" 
                : "text-gray-700 hover:text-youtube-red"
            }`}>
              Upload
            </Link>
            <Link href="/analytics" className={`transition-colors ${
              location === "/analytics" 
                ? "text-youtube-red" 
                : "text-gray-700 hover:text-youtube-red"
            }`}>
              Analytics
            </Link>
            <Link href="/settings" className={`transition-colors ${
              location === "/settings" 
                ? "text-youtube-red" 
                : "text-gray-700 hover:text-youtube-red"
            }`}>
              Settings
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm">
              <Bell className="h-4 w-4" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImageUrl || ""} alt={user?.firstName || "User"} />
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuItem className="flex flex-col items-start">
                  <div className="font-medium">{user?.firstName} {user?.lastName}</div>
                  <div className="text-sm text-muted-foreground">{user?.email}</div>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.href = "/api/logout"}>
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}
