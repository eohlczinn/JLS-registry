import {createContext,useContext,useState} from 'react';
import api from '../services/api';
const C=createContext(); export const useAuth=()=>useContext(C);
export function AuthProvider({children}){
 const[user,setUser]=useState(()=>JSON.parse(localStorage.getItem('jls-user')||'null'));
 const login=async(path,data)=>{const r=await api.post(path,data);localStorage.setItem('jls-token',r.data.accessToken);localStorage.setItem('jls-refresh-token',r.data.refreshToken||'');localStorage.setItem('jls-user',JSON.stringify(r.data.user));setUser(r.data.user);return r.data};
 const logout=async()=>{try{await api.post('/auth/logout',{refreshToken:localStorage.getItem('jls-refresh-token')},{headers:{Authorization:`Bearer ${localStorage.getItem('jls-token')}`}})}catch{}localStorage.removeItem('jls-token');localStorage.removeItem('jls-refresh-token');localStorage.removeItem('jls-user');setUser(null)};
 return <C.Provider value={{user,login,logout}}>{children}</C.Provider>;
}
