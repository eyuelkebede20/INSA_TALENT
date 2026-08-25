import { useState, useRef } from 'react';
import { signIn, useSession, fetchApi } from '../lib/api';
import { toast } from 'sonner';

export default function WebinarRegister() {
  const { data: session, isPending } = useSession();
  const [bankRef, setBankRef] = useState("");
  const [screenshotBase64, setScreenshotBase64] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check if under 1MB
    if (file.size > 1024 * 1024) {
      toast.error("File size must be under 1MB");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setScreenshotBase64("");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setScreenshotBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankRef) {
      toast.error("Please provide the bank reference number");
      return;
    }
    if (!screenshotBase64) {
      toast.error("Please provide a screenshot");
      return;
    }
    
    setLoading(true);
    try {
      await fetchApi("/students/webinar-register", {
        method: "POST",
        body: JSON.stringify({ bank_ref: bankRef, screenshot: screenshotBase64 })
      });
      setRegistered(true);
      toast.success("Successfully registered for the webinar!");
    } catch (err: any) {
      toast.error(err.message || "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  if (isPending) return (
    <div className="flex justify-center mt-20 flex-col items-center gap-4">
      <span className="loading loading-dots loading-lg text-primary"></span>
    </div>
  );

  if (!session) {
    return (
      <div className="flex justify-center mt-20">
        <div className="card w-96 bg-base-100 shadow-xl border border-base-300">
          <div className="card-body items-center text-center">
            <h2 className="card-title text-3xl font-bold mb-4">Webinar Registration</h2>
            <p className="text-base-content/70 mb-6">Sign in with your Google account to register for the paid webinar.</p>
            <button 
              onClick={async () => {
                setGoogleLoading(true);
                try {
                  const res = await signIn.social({ 
                    provider: 'google', 
                    callbackURL: `${window.location.origin}/register` 
                  });
                  if (res?.error) setGoogleLoading(false);
                } catch (e) {
                  setGoogleLoading(false);
                }
              }}
              className="btn btn-primary w-full"
              disabled={googleLoading}
            >
              {googleLoading ? <span className="loading loading-spinner"></span> : "Sign in with Google"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (registered) {
    return (
      <div className="flex justify-center mt-20">
        <div className="card w-96 bg-base-100 shadow-xl border border-base-300">
          <div className="card-body items-center text-center">
            <div className="text-success text-5xl mb-4">✓</div>
            <h2 className="card-title text-2xl font-bold mb-2">Registration Received!</h2>
            <p className="text-base-content/70">
              We have received your payment reference and screenshot. An admin will review it shortly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center mt-10">
      <div className="card w-full max-w-md bg-base-100 shadow-xl border border-base-300">
        <div className="card-body">
          <h2 className="card-title text-2xl font-bold">Register for Webinar</h2>
          <p className="text-base-content/70 mb-4">Logged in as {session.user.name}</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control w-full">
              <label className="label"><span className="label-text font-bold text-primary">Bank Reference Number</span></label>
              <input type="text" required value={bankRef} onChange={e => setBankRef(e.target.value)} className="input input-bordered input-primary w-full" placeholder="e.g. FT123456789" />
            </div>

            <div className="form-control w-full">
              <label className="label">
                <span className="label-text font-bold text-primary">Payment Screenshot</span>
                <span className="label-text-alt text-base-content/60">Max 1MB</span>
              </label>
              <input 
                type="file" 
                accept="image/*" 
                required 
                onChange={handleFileChange}
                ref={fileInputRef}
                className="file-input file-input-bordered file-input-primary w-full" 
              />
            </div>
            
            {screenshotBase64 && (
              <div className="mt-4 p-2 bg-base-200 rounded-lg border border-base-300 text-center">
                <p className="text-xs font-bold mb-2 opacity-70">Image Preview</p>
                <img src={screenshotBase64} alt="Preview" className="max-h-48 mx-auto rounded" />
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full mt-6" disabled={loading || !screenshotBase64}>
              {loading ? <span className="loading loading-spinner"></span> : "Submit Registration"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
