import { Outlet } from 'react-router-dom'; import Navbar from '../components/Navbar'; import Footer from '../components/Footer';
import SupportWidget from '../components/SupportWidget';
export default function MainLayout(){return <><Navbar/><main className="container"><Outlet/></main><Footer/><SupportWidget/></>}
