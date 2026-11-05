"use server";
import { headers } from 'next/headers';
import { getUser, createClient } from '@/lib/supabase/server';
import { sameDisplayedAccount, ACCOUNT_CHANGED } from '@/lib/product/account-guard';
export async function requestAccountClaim(expectedUserId:string,email:string){
 const user=await getUser();
 if(!sameDisplayedAccount(expectedUserId,user?.id))return{ok:false as const,error:ACCOUNT_CHANGED};
 if(!user?.is_anonymous)return{ok:false as const,error:'This account is already signed in. Manage recovery in Control.'};
 const clean=email.trim();if(clean.length>254||!/^\S+@\S+\.\S+$/.test(clean))return{ok:false as const,error:'Enter a valid email address.'};
 try{
  const supabase=await createClient();
  // Link recovery to the SAME Auth user. Never replace a guest session via signInWithOtp.
  const h=await headers();
  const origin=h.get('origin')??`${h.get('x-forwarded-proto')??'https'}://${h.get('host')}`;
  const callback=new URL('/auth/callback',origin);callback.searchParams.set('next','/control');
  const {error}=await supabase.auth.updateUser({email:clean},{emailRedirectTo:callback.toString()});
  if(error)return{ok:false as const,error:'This email could not be linked. If it belongs to an existing account, sign in separately; guest work is not automatically transferred.'};
  return{ok:true as const};
 }catch{return{ok:false as const,error:'Recovery could not connect. Your guest workspace has not changed. Retry shortly.'};}
}
