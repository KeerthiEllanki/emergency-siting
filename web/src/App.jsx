import Protected from "./Protected.jsx";
import SuitabilityApp from "./SuitabilityApp.jsx";

export default function App() {


  return (
    <Protected>
      <div className="p-4 space-y-6">
        <SuitabilityApp />
      </div>
    </Protected>
  );
}
