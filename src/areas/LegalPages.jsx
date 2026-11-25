// /privacy and /schools/data-protection.
// Every retention or deletion claim here has a mechanism; see docs/legal/dpia.md
// ("Claims and mechanisms") before changing one.
import AreaShell from './AreaShell'
import { navigate } from '../lib/routes'
import { CONTACT_EMAIL } from '../lib/contact'
import './classroom.css'

const DPA_URL = '/legal/umbra-dpa-template.docx'

function TemplateNotice() {
  return (
    <div className="cr-panel cr-panel--accent lg-template" role="note">
      <strong>Template — review with your school's DPO / legal adviser before signing.</strong>{' '}
      These documents are templates. They have not been reviewed by a lawyer, and Umbra
      holds no data-protection certification.
    </div>
  )
}

function InternalLink({ page, children }) {
  const href = page === 'schools' ? '/schools/data-protection' : '/privacy'
  return (
    <a href={href} onClick={(e) => { e.preventDefault(); navigate({ area: 'legal', page, search: '' }) }}>
      {children}
    </a>
  )
}

const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>

// ----------------------------------------------------------------- /privacy
function PrivacyNotice() {
  return (
    <article className="cr cr-stack lg">
      <header>
        <h1>Privacy notice</h1>
        <p className="cr-lede">
          This is for students aged 13 to 18 who use Umbra with their class. It explains what
          we keep about you, why, who can see it, and how long we keep it.
        </p>
      </header>
      <TemplateNotice />

      <section aria-labelledby="pn-who">
        <h2 id="pn-who">Who is in charge of your data</h2>
        <p>Your school is in charge. It decides what Umbra is used for.</p>
        <p>Umbra stores and uses your data only to run your school's classes. We follow the school's instructions.</p>
      </section>

      <section aria-labelledby="pn-what">
        <h2 id="pn-what">What we keep about you</h2>
        <ul>
          <li><strong>Your display name.</strong> This is the name you or your teacher typed. It is 1 to 40 characters long.</li>
          <li><strong>Your classes.</strong> Which classes you are in, and when you joined.</li>
          <li><strong>Your answers to set work.</strong> What you typed, whether it was right, why, how many hints you used, and how long it took.</li>
          <li><strong>How well you know each topic.</strong> Umbra works this out from your answers, so it can suggest what to practise next.</li>
        </ul>
        <h3>If you use a login card</h3>
        <p>You get a username and a passphrase. We do not have your email address.</p>
        <h3>If you sign in with Google</h3>
        <p>
          Google tells us your email address so you can sign in. It stays in the sign-in system only.
          When you join a class, we remove it from your Umbra profile. Your teacher cannot see it.
        </p>
        <h3>What we do not keep</h3>
        <p>We do not ask for your home address, date of birth or photo. We do not show you adverts. We do not sell your data.</p>
      </section>

      <section aria-labelledby="pn-why">
        <h2 id="pn-why">Why we use it</h2>
        <p>
          To let your teacher set work, check your answers, and see how the class is doing. Your school
          does this as part of teaching you. In law this is usually its "public task" (state schools)
          or its "legitimate interests" (independent schools).
        </p>
      </section>

      <section aria-labelledby="pn-see">
        <h2 id="pn-see">Who can see it</h2>
        <ul>
          <li>You.</li>
          <li>Teachers and staff at your school, for the classes you are in.</li>
          <li>A small number of Umbra staff, only to run the service or fix a problem.</li>
        </ul>
        <p>Other students cannot see your answers or your name in their lists.</p>
        <p>
          Companies that host Umbra for us also store it. They are listed on
          our <InternalLink page="schools">data protection page for schools</InternalLink>.
        </p>
      </section>

      <section aria-labelledby="pn-ai">
        <h2 id="pn-ai">The AI tutor</h2>
        <p>
          If you ask the AI tutor something, we send your question and the chat so far to Anthropic,
          the company that makes the AI. We also send the settings of the simulation you are using.
          If you click "explain" on a simulation, we send a picture of the simulation on screen.
        </p>
        <p>We do not send your name, email, class or answers to set work. Do not type personal details into the tutor.</p>
      </section>

      <section aria-labelledby="pn-device">
        <h2 id="pn-device">Camera and microphone</h2>
        <p>
          Some simulations can use your camera (hand control) or microphone (sound). This happens only if
          you turn it on. The picture and sound stay on your device. We never receive them.
        </p>
      </section>

      <section aria-labelledby="pn-long">
        <h2 id="pn-long">How long we keep it</h2>
        <ul>
          <li>While your class is in use.</li>
          <li>When your teacher archives a class, we delete it 12 months later. That includes your answers to its work.</li>
          <li>If you used a login card and you are in no other class, your whole account is deleted at the same time.</li>
          <li>If you signed in with Google and you are in no other class, your class record is deleted. Your own sign-in stays, and you can ask us to delete it.</li>
        </ul>
      </section>

      <section aria-labelledby="pn-rights">
        <h2 id="pn-rights">Your rights</h2>
        <p>You can ask to:</p>
        <ul>
          <li>see the data we keep about you,</li>
          <li>correct it if it is wrong,</li>
          <li>have it deleted,</li>
          <li>object to how it is used.</li>
        </ul>
        <p>
          Ask your teacher, or your school's data protection officer. You can also email us at <Mail />.
          We will pass your request to your school, because it is in charge.
        </p>
        <p>
          If you are unhappy, you can complain to the Information Commissioner's Office
          at <a href="https://ico.org.uk/make-a-complaint/" rel="noreferrer">ico.org.uk</a>, or to the
          data protection authority in your country.
        </p>
      </section>

      <section aria-labelledby="pn-outside">
        <h2 id="pn-outside">Using Umbra outside a class</h2>
        <p>
          You can use the simulations without an account. Your progress is then kept in your browser only.
          If you make an account, we keep your email address and your progress with it. Paid Pro plans
          are for adults; Stripe handles the payment.
        </p>
      </section>
    </article>
  )
}

// ---------------------------------------------------- /schools/data-protection
const DATA = [
  ['Display name', 'Students', '1–40 characters, typed by the student or teacher'],
  ['Class memberships', 'Students', 'Class and join date'],
  ['Attempts', 'Students', 'Response text, correct or not, the reason, hints used, time taken, assignment'],
  ['Mastery', 'Students', 'An estimate per topic, and when to review it'],
  ['Login-card username', 'Card students', 'No real email. The sign-in email is synthetic (…@students.umbra.invalid). The card student belongs to the issuing school.'],
  ['Google email', 'Google-signed-in students', 'Kept in Supabase Auth for sign-in only. Removed from the Umbra profile on joining a class. Not visible to teachers.'],
  ['Email address', 'Teachers', 'In Supabase Auth and the Umbra profile'],
]

const SUBPROCESSORS = [
  ['Supabase', 'Database and sign-in (all account and classroom data)', 'EU (region set in the Supabase project)'],
  ['Vercel', 'Website hosting, server functions (answer checking, AI proxy, login cards), cookieless page-view analytics', "Vercel's network; function region set in the Vercel project"],
  ['Anthropic', 'AI tutor only: the typed question, the chat so far, simulation settings, and (for "explain") a picture of the simulation. No names, emails, class data or answers to set work.', 'United States'],
  ['Stripe', 'Billing for paying teachers (Pro). Not used for students.', "Stripe's processing locations"],
]

function SchoolsPage() {
  return (
    <article className="cr cr-stack lg">
      <header>
        <h1>Data protection for schools</h1>
        <p className="cr-lede">
          Your school is the controller. Umbra is the processor. This page lists the data, the
          companies we use, how long we keep data, and the documents you need.
        </p>
      </header>
      <TemplateNotice />

      <section aria-labelledby="dp-docs">
        <h2 id="dp-docs">Documents</h2>
        <ul>
          <li>
            <a href={DPA_URL} download>Data Processing Agreement template (.docx)</a>. Fill in the
            blanks and review it with your DPO. We also accept your school's own DPA form.
          </li>
          <li>Data Protection Impact Assessment (DPIA): ask us at <Mail /> and we will send our completed copy.</li>
          <li>The student <InternalLink page="privacy">privacy notice</InternalLink>, written for ages 13–18.</li>
        </ul>
      </section>

      <section aria-labelledby="dp-data">
        <h2 id="dp-data">Data we hold</h2>
        <div className="lg-table-wrap">
          <table className="lg-table">
            <thead>
              <tr><th scope="col">Data</th><th scope="col">About</th><th scope="col">Detail</th></tr>
            </thead>
            <tbody>
              {DATA.map(([d, who, detail]) => (
                <tr key={d}><th scope="row">{d}</th><td>{who}</td><td>{detail}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cr-small cr-muted">No student real names are required, and no student email is stored in the classroom tables.</p>
      </section>

      <section aria-labelledby="dp-sub">
        <h2 id="dp-sub">Sub-processors</h2>
        <div className="lg-table-wrap">
          <table className="lg-table">
            <thead>
              <tr><th scope="col">Company</th><th scope="col">What for</th><th scope="col">Where</th></tr>
            </thead>
            <tbody>
              {SUBPROCESSORS.map(([n, what, where]) => (
                <tr key={n}><th scope="row">{n}</th><td>{what}</td><td>{where}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cr-small cr-muted">
          Some pages load public files straight from other services, which then see the visitor's IP
          address: Google Fonts (all pages); jsDelivr and Google Cloud Storage (the hand-tracking model,
          only when hand control is turned on); YouTube's no-cookie player and NASA's image library (the
          telescope page). Google is also the sign-in provider for anyone who chooses "Sign in with Google".
          We will tell schools with a signed DPA before adding a sub-processor.
        </p>
      </section>

      <section aria-labelledby="dp-ret">
        <h2 id="dp-ret">Retention and deletion</h2>
        <ul>
          <li>
            <strong>Archived classes:</strong> a scheduled job runs daily and deletes every class archived more
            than 12 months ago, with its assignments, enrolments and the attempts on its work.
          </li>
          <li>
            <strong>Card students</strong> left with no class are then deleted completely, sign-in included.
          </li>
          <li>
            <strong>Google-signed-in students</strong> left with no class lose their classroom record (name,
            attempts, mastery). Their own sign-in account is theirs and is kept until they ask us to delete it.
          </li>
          <li>
            <strong>Deletion requests:</strong> email <Mail /> from a school address. We delete the student's
            record (enrolments, attempts and mastery go with it) and confirm in writing.
          </li>
          <li>
            <strong>End of contract:</strong> on the school's instruction we delete all of its classes and
            card students the same way, and confirm in writing.
          </li>
        </ul>
      </section>

      <section aria-labelledby="dp-sec">
        <h2 id="dp-sec">Security</h2>
        <ul>
          <li>Row-level security in the database: staff see only their own school's classes; students see only their own work.</li>
          <li>Answer checking runs on the server. Only the server writes attempts.</li>
          <li>Secret keys stay on the server and never reach the browser.</li>
          <li>All traffic uses HTTPS.</li>
        </ul>
      </section>
    </article>
  )
}

export default function LegalPages({ route }) {
  return (
    <AreaShell>
      {route?.page === 'schools' ? <SchoolsPage /> : <PrivacyNotice />}
    </AreaShell>
  )
}
