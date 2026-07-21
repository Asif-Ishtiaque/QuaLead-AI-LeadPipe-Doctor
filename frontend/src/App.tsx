import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Overview from "./pages/Overview";
import Leads from "./pages/Leads";
import LeadAnalytics from "./pages/LeadAnalytics";
import DataQuality from "./pages/DataQuality";
import SelfHealing from "./pages/SelfHealing";
import Upload from "./pages/Upload";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Overview />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/analytics" element={<LeadAnalytics />} />
        <Route path="/data-quality" element={<DataQuality />} />
        <Route path="/self-healing" element={<SelfHealing />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
