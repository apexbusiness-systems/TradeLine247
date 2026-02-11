import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Mail, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client.ts';
import { errorReporter } from '@/lib/errorReporter';
import { ensureMembership } from '@/lib/ensureMembership';

interface InviteStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InviteStaffDialog: React.FC<InviteStaffDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [name, setName] = useState('');

  const handleInvite = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to invite team members');
      }

      // Get the organization ID for the current user
      const { orgId, error: orgError } = await ensureMembership(user);
      
      if (orgError || !orgId) {
        throw new Error(orgError || 'Could not determine your organization. Please contact support.');
      }

      // Call the Edge Function to handle the invitation
      const { data, error } = await supabase.functions.invoke('invite-staff', {
        body: {
          email,
          role,
          name,
          organization_id: orgId,
        },
      });

      if (error) {
        // Try to parse the error message from the response body if possible
        // The Supabase JS client usually puts the response body in error.context if it's an HTTP error
        let errorMessage = error.message;
        try {
            if (error instanceof Error && 'context' in error && (error as any).context instanceof Response) {
                const body = await (error as any).context.json();
                if (body && body.error) {
                    errorMessage = body.error;
                }
            }
        } catch (e) {
            // Ignore parsing errors
        }
        throw new Error(errorMessage);
      }

      if (data?.warning) {
          toast.warning(data.warning);
      } else {
          toast.success('Invitation sent successfully', {
            description: `An invitation has been sent to ${email}`,
          });
      }

      setEmail('');
      setName('');
      onOpenChange(false);
    } catch (error: any) {
      errorReporter.report({
        type: 'error',
        message: `Error inviting staff: ${error.message || 'Unknown error'}`,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        environment: errorReporter['getEnvironment'](),
        metadata: { email, role, error }
      });
      toast.error('Failed to send invitation', {
        description: error.message || 'Please try again later',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation to join your TradeLine 24/7 workspace
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name (Optional)</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="colleague@company.com"
                className="pl-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole} disabled={loading}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin - Full access</SelectItem>
                <SelectItem value="member">Member - Standard access</SelectItem>
                <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === 'admin' && 'Can manage all settings and invite others'}
              {role === 'member' && 'Can view and manage calls and integrations'}
              {role === 'viewer' && 'Can only view data and reports'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
