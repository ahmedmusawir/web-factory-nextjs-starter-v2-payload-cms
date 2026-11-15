import { WebsitePage, websiteMetadata } from '@/components/cyberize/website-page'
export const revalidate = 30
export const generateMetadata = () => websiteMetadata('home')
export default function Home() { return <WebsitePage slug="home" /> }
