import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="container mx-auto flex flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-xl text-muted-foreground mb-4">Oops! Page not found</p>
      <Link to="/" className="text-primary underline-offset-4 hover:underline">
        Return to Home
      </Link>
    </div>
  );
};

export default NotFound;
