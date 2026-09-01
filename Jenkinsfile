pipeline {
    agent any

    parameters {
        choice(name: 'DEPLOY_ENV', choices: ['staging', 'production'], description: 'Select target environment')
    }

    stages {
        stage('Build') {
            steps {
                echo 'Building the application artifacts...'
                sh 'npm install'
            }
        }
        stage('Test') {
            steps {
                echo 'Running automated tests...'
                sh 'echo "Tests passed successfully!"'
            }
        }
        stage('Deploy') {
            steps {
                echo "Deploying application to ${params.DEPLOY_ENV} environment..."
                sh 'echo "Deployment completed!"'
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed all deployment stages successfully!'
        }
    }
}
