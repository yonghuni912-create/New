'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load saved credentials on component mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const shouldAutoLogin = localStorage.getItem('autoLogin') === 'true';
    const savedPassword = localStorage.getItem('savedPassword');

    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }

    if (shouldAutoLogin && savedEmail && savedPassword) {
      setAutoLogin(true);
      setPassword(savedPassword);
      // Auto login after a brief delay
      setTimeout(() => {
        handleAutoLogin(savedEmail, savedPassword);
      }, 500);
    }
  }, []);

  const handleAutoLogin = async (savedEmail: string, savedPassword: string) => {
    setIsLoading(true);
    try {
      const result = await signIn('credentials', {
        email: savedEmail,
        password: savedPassword,
        redirect: false,
      });

      if (result?.error) {
        toast.error('Auto-login failed. Please sign in manually.');
        localStorage.removeItem('autoLogin');
        localStorage.removeItem('savedPassword');
      } else {
        toast.success('Auto-login successful!');
        router.push('/dashboard');
        router.refresh();
      }
    } catch (error) {
      toast.error('Auto-login error');
      localStorage.removeItem('autoLogin');
      localStorage.removeItem('savedPassword');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error('Invalid credentials');
      } else {
        // Save credentials based on user preferences
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', email);
        } else {
          localStorage.removeItem('rememberedEmail');
        }

        if (autoLogin) {
          localStorage.setItem('autoLogin', 'true');
          localStorage.setItem('savedPassword', password);
        } else {
          localStorage.removeItem('autoLogin');
          localStorage.removeItem('savedPassword');
        }

        toast.success('Login successful!');
        router.push('/dashboard');
        router.refresh();
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">BBQ Franchise Management</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@bbq.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            
            {/* Remember Me and Auto Login checkboxes */}
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={isLoading}
                />
                <Label htmlFor="rememberMe" className="ml-2 text-sm text-gray-700 cursor-pointer">
                  Remember Email
                </Label>
              </div>
              
              <div className="flex items-center">
                <input
                  id="autoLogin"
                  type="checkbox"
                  checked={autoLogin}
                  onChange={(e) => setAutoLogin(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={isLoading}
                />
                <Label htmlFor="autoLogin" className="ml-2 text-sm text-gray-700 cursor-pointer">
                  Auto Login (Keep me signed in)
                </Label>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-6 text-sm text-gray-500 space-y-1">
            <p className="font-semibold">Demo Accounts:</p>
            <p>Admin: admin@bbq.com / admin123</p>
            <p>PM: pm@bbq.com / pm123</p>
            <p>User: user@bbq.com / user123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
